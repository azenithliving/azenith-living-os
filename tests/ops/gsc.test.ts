// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { gscConfig, parseGscRows, fetchSearchQueries, renderGscResult } from '@/lib/ops/gsc';
import { inferUltimateTool } from '@/lib/admin-tool-bridge';

// A throwaway RSA key generated for this test only. It authorizes nothing in
// any system; it exists so the signing code path can be exercised for real.
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const CREDS = JSON.stringify({
  type: 'service_account',
  project_id: 'p',
  private_key_id: 'k',
  private_key: privateKey,
  client_email: 'bot@p.iam.gserviceaccount.com',
  token_uri: 'https://oauth2.googleapis.com/token',
});

describe('gsc config gate', () => {
  it('reports exactly which env vars are missing when nothing is configured', () => {
    const cfg = gscConfig({} as NodeJS.ProcessEnv);
    expect(cfg.ready).toBe(false);
    expect(cfg.missing).toContain('GSC_SITE_URL');
    expect(cfg.missing).toContain('GOOGLE_APPLICATION_CREDENTIALS_JSON');
  });

  it('is ready only when both site and credentials exist', () => {
    const cfg = gscConfig({ GSC_SITE_URL: 'sc-domain:x.com', GOOGLE_APPLICATION_CREDENTIALS_JSON: CREDS } as NodeJS.ProcessEnv);
    expect(cfg.ready).toBe(true);
    expect(cfg.siteUrl).toBe('sc-domain:x.com');
  });
});

describe('parseGscRows', () => {
  it('maps API rows to a readable table and sorts by clicks', () => {
    const rows = parseGscRows({
      rows: [
        { keys: ['كنبة ذهبية'], clicks: 2, impressions: 100, ctr: 0.02, position: 7.5 },
        { keys: ['صالون ملكي'], clicks: 9, impressions: 300, ctr: 0.03, position: 3.1 },
      ],
    });
    expect(rows[0].query).toBe('صالون ملكي');
    expect(rows[1].clicks).toBe(2);
    expect(rows[0].position).toBeCloseTo(3.1);
  });

  it('tolerates an empty or malformed payload', () => {
    expect(parseGscRows({})).toEqual([]);
    expect(parseGscRows(null)).toEqual([]);
    expect(parseGscRows({ rows: [{ keys: [] }] })).toEqual([]);
  });
});

describe('fetchSearchQueries', () => {
  it('refuses without inventing queries', async () => {
    const r = await fetchSearchQueries({ env: {} as NodeJS.ProcessEnv });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['GSC_SITE_URL', 'GOOGLE_APPLICATION_CREDENTIALS_JSON']);
  });

  it('signs a request and returns real rows when the API answers', async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    const fakeFetch = async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? String(init.body) : undefined });
      if (String(url).includes('oauth2')) return Response.json({ access_token: 'ya29.mock', expires_in: 3600 });
      return Response.json({ rows: [{ keys: ['سرير ملكي'], clicks: 5, impressions: 42, ctr: 0.11, position: 4 }] });
    };
    const r = await fetchSearchQueries({
      env: { GSC_SITE_URL: 'sc-domain:azenith.example', GOOGLE_APPLICATION_CREDENTIALS_JSON: CREDS } as NodeJS.ProcessEnv,
      fetchImpl: fakeFetch as typeof fetch,
    });
    expect(r.ok).toBe(true);
    expect(r.rows?.[0]).toMatchObject({ query: 'سرير ملكي', clicks: 5 });
    expect(calls[0].url).toContain('oauth2.googleapis.com/token');
    expect(calls[0].body).toContain('jwt-bearer');
    // The path Google's own discovery document publishes: version 3, and the
    // site is a PATH segment, not a query parameter.
    expect(calls[1].url).toBe(
      "https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aazenith.example/searchAnalytics/query"
    );
    expect(calls[1].body).toContain('"dimensions":["query"]');
  });

  it('surfaces an API error instead of returning an empty success', async () => {
    const fakeFetch = async (url: string) =>
      String(url).includes('oauth2')
        ? Response.json({ access_token: 'ya29.mock' })
        : new Response(JSON.stringify({ error: { message: 'Site not found' } }), { status: 403 });
    const r = await fetchSearchQueries({
      env: { GSC_SITE_URL: 'https://bad.example/', GOOGLE_APPLICATION_CREDENTIALS_JSON: CREDS } as NodeJS.ProcessEnv,
      fetchImpl: fakeFetch as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Site not found');
  });
});

describe('refusal copy', () => {
  it('names the missing variables and the shortest path to enable them', () => {
    const msg = renderGscResult({ ok: false, missing: ['GSC_SITE_URL', 'GOOGLE_APPLICATION_CREDENTIALS_JSON'] });
    expect(msg).toContain('موصولةش');
    expect(msg).toContain('GSC_SITE_URL');
    expect(msg).toContain('5 دقايق');
  });

  it('renders rows as numbers, not prose', () => {
    const msg = renderGscResult({ ok: true, rows: [{ query: 'كنبة', clicks: 3, impressions: 50, ctr: 0.06, position: 2 }], range: { start: '2026-08-26', end: '2026-09-24' } });
    expect(msg).toContain('كنبة');
    expect(msg).toContain('3');
  });
});

describe('gsc_queries routing', () => {
  it.each(['كلمات البحث اللي جابلي زيارات', 'اعرض لي بيانات search console', 'جوجل ليا بنظهر في ايه', 'what queries bring traffic'])(
    'sends "%s" to gsc_queries',
    (msg) => {
      expect(inferUltimateTool(msg)?.toolName).toBe('gsc_queries');
    }
  );

  it('does not hijack the world-model or SEO-page questions', () => {
    expect(inferUltimateTool('ايزاي الشغل الفترة دي')?.toolName).toBe('qayyim_world');
    expect(inferUltimateTool('حلل SEO للصفحة الرئيسية')?.toolName).not.toBe('gsc_queries');
  });
});
