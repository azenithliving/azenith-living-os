// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  parseRobots,
  isAllowedByRobots,
  collectInternalLinks,
  extractSignals,
  diffSignals,
  crawlRival,
  renderRivalsDigest,
  skippedNote,
  type RivalSignals,
} from '@/lib/ops/rivals';
import { inferUltimateTool } from '@/lib/admin-tool-bridge';

const sig = (over: Partial<RivalSignals> = {}): RivalSignals => ({
  pagesExamined: 5,
  title: 'صالونات ملكي',
  h1Count: 2,
  productLinks: 30,
  visiblePrices: 12,
  priceCurrencies: ['ج.م'],
  whatsapp: true,
  gallerySignals: 8,
  textWords: 900,
  ...over,
});

describe('robots politeness', () => {
  it('reads the * group rules only', () => {
    const r = parseRobots(`User-agent: *\nDisallow: /admin\nDisallow: /cart\nAllow: /cart/view\nCrawl-delay: 2\n\nUser-agent: GPTBot\nDisallow: /`);
    expect(r.disallow).toEqual(['/admin', '/cart']);
    expect(r.allow).toEqual(['/cart/view']);
    expect(r.crawlDelay).toBe(2);
  });

  it('treats a missing or unreadable robots.txt as allowed, not as a wall', () => {
    const empty = parseRobots('');
    expect(isAllowedByRobots(empty, 'https://x.example/a')).toBe(true);
  });

  it('blocks disallowed paths and lets the longest matching rule win', () => {
    const r = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/public-page');
    expect(isAllowedByRobots(r, 'https://x.example/private/secret')).toBe(false);
    expect(isAllowedByRobots(r, 'https://x.example/private/public-page')).toBe(true);
    expect(isAllowedByRobots(r, 'https://x.example/shop')).toBe(true);
  });
});

describe('link collection', () => {
  it('keeps same-host page links and drops assets, anchors and mailto', () => {
    const html = `<a href="/rooms">rooms</a><a href="https://other.example/x">out</a>
      <a href="/a.jpg">img</a><a href="#top">top</a><a href="mailto:a@b.c">mail</a>
      <a href="/rooms/">dup</a><a href="/furniture?cat=sofa">q</a>`;
    expect(collectInternalLinks(html, 'https://rival.example/')).toEqual([
      'https://rival.example/rooms',
      'https://rival.example/furniture?cat=sofa',
    ]);
  });
});

describe('extractSignals', () => {
  it('measures the things that matter to a store, not prose', () => {
    const html = `<html><head><title>أثاث فاخر — القاهرة</title></head><body>
      <h1>صالونات</h1><h1>غرف نوم</h1>
      <a href="/product/1">12,500 ج.م</a><a href="/product/2">9,000 EGP</a>
      <a href="https://wa.me/201000000000">واتساب</a>
      <img src="/g/1.jpg" alt="p"><img src="/g/2.jpg" alt="p">
      <p>${'كلمة '.repeat(40)}</p></body></html>`;
    const s = extractSignals(html);
    expect(s.title).toBe('أثاث فاخر — القاهرة');
    expect(s.h1Count).toBe(2);
    expect(s.visiblePrices).toBe(2);
    expect(s.priceCurrencies.sort()).toEqual(['EGP', 'ج.م']);
    expect(s.whatsapp).toBe(true);
    expect(s.gallerySignals).toBeGreaterThanOrEqual(2);
    expect(s.textWords).toBeGreaterThan(30);
  });

  it('survives a garbage document without inventing numbers', () => {
    const s = extractSignals('not html at all');
    expect(s).toMatchObject({ h1Count: 0, visiblePrices: 0, whatsapp: false, productLinks: 0 });
    expect(s.title).toBeNull();
  });
});

describe('diffSignals', () => {
  it('names what changed instead of restating both snapshots', () => {
    const d = diffSignals(sig({ productLinks: 20, visiblePrices: 5 }), sig({ productLinks: 30, visiblePrices: 12 }));
    expect(d.join(' ')).toContain('+10');
    expect(d.join(' ')).toContain('+7');
  });

  it('says nothing changed when nothing did', () => {
    expect(diffSignals(sig(), sig())).toEqual([]);
  });

  it('marks a first-ever crawl as a baseline', () => {
    expect(diffSignals(null, sig())[0]).toContain('أول قياس');
  });
});

describe('crawlRival politeness and caps', () => {
  const page = (links: string[]) =>
    `<html><head><title>t</title></head><body>${links.map((l) => `<a href="${l}">x</a>`).join('')}</body></html>`;

  it('refuses paths robots.txt disallows', async () => {
    const calls: string[] = [];
    const fake = async (url: string) => {
      calls.push(String(url));
      if (String(url).endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /', { status: 200 });
      return new Response(page(['/a']), { status: 200 });
    };
    const r = await crawlRival({ id: 'r1', name: 'منافس', url: 'https://x.example' }, { fetchImpl: fake as typeof fetch, delayMs: 0 });
    expect(r.status).toBe('blocked_by_robots');
    expect(calls).toEqual(['https://x.example/robots.txt']);
  });

  it('crawls at most maxPages and returns measured signals', async () => {
    let hits = 0;
    const fake = async (url: string) => {
      if (String(url).endsWith('/robots.txt')) return new Response('', { status: 404 });
      hits++;
      return new Response(page([`/p${hits}`, `/p${hits + 50}`]), { status: 200 });
    };
    const r = await crawlRival({ id: 'r1', name: 'منافس', url: 'https://x.example' }, { fetchImpl: fake as typeof fetch, maxPages: 3, delayMs: 0 });
    expect(r.status).toBe('completed');
    expect(r.pagesCrawled).toBeLessThanOrEqual(3);
    expect(r.summary!.pagesExamined).toBe(r.pagesCrawled);
  });

  it('reports a dead rival instead of a confident zero', async () => {
    const fake = async () => new Response('boom', { status: 503 });
    const r = await crawlRival({ id: 'r1', name: 'منافس', url: 'https://down.example' }, { fetchImpl: fake as typeof fetch, delayMs: 0 });
    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/HTTP 503|غير متاح/);
  });
});

describe('digest', () => {
  it('tells the owner how to add a rival when none is configured', () => {
    const d = renderRivalsDigest([]);
    expect(d).toContain('مضفتش');
    expect(d).toMatch(/qayyim_rivals|ضيف/);
  });

  it('summarises each rival with its latest change list', () => {
    const d = renderRivalsDigest([
      { name: 'منافس ألف', url: 'https://a.example', crawledAt: '2026-09-21T07:00:00Z', status: 'completed', signals: sig(), changes: ['+10 روابط منتج'] },
      { name: 'منافس باء', url: 'https://b.example', crawledAt: '2026-09-21T07:00:00Z', status: 'failed', error: 'HTTP 503' },
    ]);
    expect(d).toContain('منافس ألف');
    expect(d).toContain('+10 روابط منتج');
    expect(d).toContain('HTTP 503');
  });

  it('names rivals the time budget could not reach instead of hiding them', () => {
    expect(skippedNote([])).toBe('');
    expect(skippedNote(['منافس جيم'])).toContain('منافس جيم');
    expect(skippedNote(['منافس جيم'])).toContain('لم أقيس');
  });
});

describe('ops_rivals routing', () => {
  it.each(['المنافسين بيعملوا ايه', 'قارننا بالمنافس الفلاني', 'رصد المنافسين', 'competitor watch'])(
    'sends "%s" to ops_rivals',
    (msg) => expect(inferUltimateTool(msg)?.toolName).toBe('ops_rivals')
  );

  it('does not steal the world-model question', () => {
    expect(inferUltimateTool('ايزاي الشغل الفترة دي')?.toolName).toBe('ops_world');
  });
});
