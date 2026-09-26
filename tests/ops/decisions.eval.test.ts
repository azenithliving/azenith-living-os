/**
 * P6-M5 — the immune system's first organ: a golden decision eval.
 *
 * Every row below is a sentence the owner (or the swarm's own cron) actually
 * produced, paired with the decision the code must make about it. The point is
 * not coverage of the functions — `brain.test.ts` and `stats.test.ts` do that —
 * it is that a prompt, regex, or threshold edit that silently changes a decision
 * fails here before it reaches the shop. Run this before touching any prompt.
 *
 * Pure: no network, no database, no model call. `checkAll` never reaches the LLM
 * (the import at the top of ConstitutionEngine is unused), and the routing table
 * stops at the deterministic fast path.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { inferUltimateTool } from '@/lib/admin-tool-bridge';
import { parseIntent, TOOL_CATALOG } from '@/lib/agents/intent-router';
import { buildResultActions } from '@/lib/admin-result-actions';
import { isRealPath, toPath } from '@/lib/ops/url-manifest';
import { deriveActions } from '@/lib/ops/chat-brain';
import { shouldDebate } from '@/lib/ops/debate';
import { constitutionEngine } from '@/lib/ops/governance/ConstitutionEngine';
import { explainGap } from '@/lib/ops/gap-contract';
import { holtWinters, twoProportionZTest } from '@/lib/ops/stats';

/** Counted so the milestone's acceptance number is enforced by the suite itself. */
let GOLDEN_CASES = 0;
function caseOf<T>(label: string, input: T) {
  GOLDEN_CASES++;
  return { label, input };
}

// ─── 1. Fast-path routing: dialect the owner really types ────────────────────
// Hamza variants are spelled out on purpose — the whole swarm was once muted by
// a routing regex that only matched «أنت».
const ROUTING = [
  caseOf('hamza: what do you do', ['انت بتعمل إيه؟', 'ops_self']),
  caseOf('no hamza: what do you do', ['انت بتعمل ايه؟', 'ops_self']),
  caseOf('know your limits', ['قدراتك إيه', 'ops_self']),
  caseOf('introduce yourself', ['عرف نفسك', 'ops_self']),
  caseOf('who are you (english)', ['who are you', 'ops_self']),
  caseOf('forecast a month', ['توقع مبيعات الشهر الجاي', 'ops_forecast']),
  caseOf('forecast a week', ['توقع الأسبوع الجاي', 'ops_forecast']),
  caseOf('shop trend', ['ايزاي الشغل الفترة دي', 'ops_world']),
  caseOf('what sells', ['اللي بيبيع دلوقتي', 'ops_world']),
  caseOf('search phrases', ['كلمات البحث اللي جت زوار', 'gsc_queries']),
  caseOf('competitors', ['المنافسين نزلوا تشكيلة جديدة', 'ops_rivals']),
  caseOf('draft count', ['كام مسودة معلقة', 'draft_list']),
  caseOf('draft queue mentioning publish is still a count', ['المسودات المعلقة للمراجعة والنشر', 'draft_list']),
  caseOf('site feels heavy', ['الموقع تقيل', 'speed_analyze']),
  caseOf('luxury index', ['مؤشر الفخامة كام', 'ops_luxury_score']),
  caseOf('goal at risk', ['أي هدف مهدد', 'ops_goals_risk']),
  caseOf('fix seo', ['صلح مشاكل ال SEO', 'seo_fix_issues']),
  caseOf('security headers', ['افحص رؤوس الأمان', 'qa_security_headers']),
  caseOf('memory is not a tool', ['تذكر اللي قلتلك عليه', null]),
];

describe('eval: intent fast-path (deterministic, no model)', () => {
  for (const { label, input } of ROUTING) {
    const [message, expected] = input;
    it(`${label} → ${String(expected)}`, () => {
      expect(inferUltimateTool(message)?.toolName ?? null).toBe(expected);
    });
  }

  it('a forecast phrased as a week carries a 7-day horizon, a month 30', () => {
    expect(inferUltimateTool('توقع الأسبوع الجاي')?.params.horizonDays).toBe(7);
    expect(inferUltimateTool('توقع مبيعات الشهر الجاي')?.params.horizonDays).toBe(30);
  });

  it('page-scoped tools never route without a url', () => {
    for (const name of ['speed_analyze', 'seo_analyze', 'qa_security_headers']) {
      const phrasing =
        name === 'speed_analyze' ? 'الموقع تقيل' : name === 'seo_analyze' ? 'عايز seo' : 'افحص رؤوس الأمان';
      const intent = inferUltimateTool(phrasing);
      expect(intent?.toolName).toBe(name);
      expect(typeof intent?.params.url).toBe('string');
    }
  });
});

// ─── 2. Whitelist: a hallucinated tool must never reach execution ────────────
const INTENT_JSON = [
  caseOf('whitelisted tool passes', ['{"toolName":"ops_self","params":{}}', 'ops_self']),
  caseOf('fenced json is stripped', ['```json\n{"toolName":"draft_list","params":{}}\n```', 'draft_list']),
  caseOf('none means no tool', ['{"toolName":"none","params":{}}', null]),
  caseOf('invented tool rejected', ['{"toolName":"make_me_rich","params":{}}', null]),
  caseOf('re-cased tool rejected', ['{"toolName":"SEO_ANALYZE","params":{}}', null]),
  caseOf('prefix of a real tool rejected', ['{"toolName":"ops_self_extra","params":{}}', null]),
  caseOf('prose rejected', ['أعتقد إنك محتاج تشوف المسودات', null]),
  caseOf('broken json rejected', ['{"toolName":"', null]),
  caseOf('non-object params become empty', ['{"toolName":"seo_analyze","params":"site"}', 'seo_analyze']),
];

describe('eval: intent whitelist rejects', () => {
  for (const { label, input } of INTENT_JSON) {
    const [raw, expected] = input;
    it(`${label} → ${String(expected)}`, () => {
      expect(parseIntent(raw)?.toolName ?? null).toBe(expected);
    });
  }

  it('non-object params are replaced, not forwarded', () => {
    expect(parseIntent('{"toolName":"seo_analyze","params":"site"}')?.params).toEqual({});
  });

  it('every routed name exists in the catalog the model was shown', () => {
    const names = new Set(TOOL_CATALOG.map((t) => t.name));
    for (const { input } of INTENT_JSON) {
      const parsed = parseIntent(input[0]);
      if (parsed) expect(names.has(parsed.toolName)).toBe(true);
    }
  });
});

// ─── 3. Link truth: the paths the site actually serves ───────────────────────
const PATHS = [
  caseOf('home', ['/', true]),
  caseOf('rooms index', ['/rooms', true]),
  caseOf('real room', ['/rooms/corner-sofa', true]),
  caseOf('aliased room', ['/rooms/office', true]),
  caseOf('catalog search', ['/furniture/سفرة', true]),
  caseOf('admin root', ['/admin', true]),
  caseOf('admin section the owner uses', ['/admin/v2/agents/ops', true]),
  caseOf('room with query and hash', ['/rooms/lounge?x=1#y', true]),
  caseOf('absolute url of a real page', ['https://azenith-living.vercel.app/rooms', true]),
  caseOf('seo landing page is a real route', ['/seo/custom-furniture-egypt', true]),
  caseOf('invented product detail', ['/products/sofa-royal-cream', false]),
  caseOf('invented room', ['/rooms/pantry-room', false]),
  caseOf('invented admin report', ['/admin/reports/weekly-pdf', false]),
  caseOf('section folder with no page in it', ['/admin/whatsapp', false]),
  caseOf('trailing slash on a fake path stays fake', ['/rooms/living/', false]),
  caseOf('score is not a path', ['93/100', false]),
  caseOf('relative word is not a path', ['rooms', false]),
  caseOf('external host is not our manifest', ['https://example.com/rooms', false]),
];

describe('eval: link truth table', () => {
  for (const { label, input } of PATHS) {
    const [candidate, expected] = input;
    it(`${label}: ${candidate} → ${expected}`, () => {
      expect(isRealPath(candidate)).toBe(expected);
    });
  }

  it('normalization strips query, hash and trailing slash', () => {
    expect(toPath('https://azenith-living.vercel.app/rooms/kitchen/?utm=x#top')).toBe('/rooms/kitchen');
  });
});

// ─── 4. Action buttons the owner can actually tap ────────────────────────────
const ACTIONS = [
  caseOf('quoted imperative after "اكتب لي"', ['اكتب لي "أصلح وصف الصوفا الملكية"', ['أصلح وصف الصوفا الملكية']]),
  caseOf('quoted imperative after "اضغط"', ['اضغط "وافق" لو عايز ينفذ', ['وافق']]),
  caseOf('quoted bullet command', ['• "أنشئ مسودة للهيرو"', ['أنشئ مسودة للهيرو']]),
  caseOf('prose with no quotes yields no buttons', ['الشغل كويس والمبيعات ثابتة', []]),
  caseOf('a two-character label is noise, not a button', ['قل "أه"', []]),
];

describe('eval: derived actions', () => {
  for (const { label, input } of ACTIONS) {
    const [text, expected] = input;
    it(label, () => {
      expect(deriveActions(text)).toEqual(expected);
    });
  }

  it('caps at three buttons and drops repeats', () => {
    const four = ['ا', 'ب', 'ج', 'د'].map((s) => `قل "اكتب ${s} مسودة كاملة"`).join('\n');
    const got = deriveActions(four);
    expect(got.length).toBeLessThanOrEqual(3);
    expect(new Set(got).size).toBe(got.length);
  });
});

// ─── 4b. Action buttons: a tap must land on a page ──────────────────────────
describe('eval: result action buttons never point at a dead page', () => {
  it('keeps an internal href that resolves', () => {
    expect(buildResultActions({ url: '/admin/v2/settings' })).toHaveLength(1);
  });

  it('drops an internal href that does not', () => {
    expect(buildResultActions({ url: '/admin/reports/weekly-pdf' })).toHaveLength(0);
  });

  it('leaves an external link alone', () => {
    expect(buildResultActions({ url: 'https://example.com/report.pdf' })).toHaveLength(1);
  });

  it('sends a product result somewhere the owner can open', () => {
    const actions = buildResultActions({ productId: '11111111-1111-4111-8111-111111111111' });
    expect(actions).toHaveLength(1);
    expect(isRealPath(actions[0].href)).toBe(true);
  });

  it('sends a category result somewhere the owner can open', () => {
    const actions = buildResultActions({ categoryId: '22222222-2222-4222-8222-222222222222' });
    expect(actions).toHaveLength(1);
    expect(isRealPath(actions[0].href)).toBe(true);
  });
});

// ─── 5. Identity law: prose is judged, structure is not ─────────────────────
// The engine once JSON.stringify()d every draft, so any structured draft failed
// on its own english keys. Only human-readable Arabic values may block.
async function identityViolations(content: unknown) {
  const report = await constitutionEngine.checkAll({
    agentKey: 'ops-content',
    actionType: 'draft',
    content,
  });
  return report.results.flatMap((r) => r.violations.filter((v) => v.ruleId === 'identity_law'));
}

describe('eval: identity law', () => {
  it('blocks an english word inside Arabic prose', async () => {
    const v = await identityViolations({ title: 'صوفا ملكية بخامات premium' });
    expect(v.length).toBeGreaterThan(0);
    expect(v.some((x) => /إنجليزي/.test(x.message))).toBe(true);
  });

  it('allows english json keys and urls when the prose is pure arabic', async () => {
    const v = await identityViolations({
      versionNumber: 3,
      seoScore: 88,
      imageUrl: 'https://cdn.example.com/a.jpg',
      text: 'صوفا ملكية بصناعة إتقان وإطلالة لا تُضاهى',
    });
    expect(v).toEqual([]);
  });

  it('blocks a cheap marketing term even in a nested value', async () => {
    const v = await identityViolations({ sections: [{ body: 'خصم كبير لفترة محدودة على كل الأقسام' }] });
    expect(v.length).toBeGreaterThan(0);
  });

  it('a url inside arabic prose does not count as english', async () => {
    const v = await identityViolations({ text: 'التفاصيل الكاملة في صفحة الغرف الملكية https://azenith-living.vercel.app/rooms' });
    expect(v).toEqual([]);
  });

  it('an all-english string is not arabic prose, so identity law stays out of it', async () => {
    const v = await identityViolations({ text: 'Royal sofa, hand finished, gold leaf' });
    expect(v).toEqual([]);
  });

  it('proposes luxury wording instead of leaving a bare block', async () => {
    const v = await identityViolations({ title: 'سعر قليل و صفقة حالية' });
    expect(v[0]?.suggestedFix).toBeTruthy();
  });
});

// ─── 6. The critic gate: only long actionable answers pay for a second pass ──
const LONG_ENOUGH = 'خطة تحسين محتوى الصفحة الرئيسية للمحل بالكامل، ' + 'بند تفصيلي قابل للتنفيذ '.repeat(12);
const LONG_BUT_PLAIN = 'النظام شغال بشكل طبيعي ولم تسجل أي ملاحظات تقنية اليوم، ' + 'وكل القياسات داخل حدودها الطبيعية '.repeat(6);

describe('eval: debate gate', () => {
  it('debates a long actionable answer', () => {
    expect(shouldDebate(LONG_ENOUGH)).toBe(true);
  });
  it('spares a long status report', () => {
    expect(shouldDebate(LONG_BUT_PLAIN)).toBe(false);
  });
  it('spares a short draft command', () => {
    expect(shouldDebate('أنشئ مسودة')).toBe(false);
  });
  it('spares empty input', () => {
    expect(shouldDebate('')).toBe(false);
  });
});

// ─── 7. A/B arithmetic against hand-computed rates ──────────────────────────
describe('eval: two-proportion z-test', () => {
  it('5% against 8% on a thousand each is a win', () => {
    const r = twoProportionZTest(1000, 50, 1000, 80);
    expect(r.verdict).toBe('measured');
    expect(r.significant).toBe(true);
    expect(r.treatmentWins).toBe(true);
    expect(r.p ?? 1).toBeLessThan(0.05);
  });

  it('5% against 5.2% on a thousand each is noise', () => {
    const r = twoProportionZTest(1000, 50, 1000, 52);
    expect(r.verdict).toBe('measured');
    expect(r.significant).toBe(false);
    expect(r.treatmentWins).toBeNull();
  });

  it('six visitors is no data, not a tie', () => {
    const r = twoProportionZTest(6, 1, 6, 3);
    expect(r.verdict).toBe('no-data');
    expect(r.significant).toBe(false);
  });

  it('full traffic with zero conversions is reported as empty, not divided by zero', () => {
    const r = twoProportionZTest(4000, 0, 4000, 0);
    expect(r.verdict).toBe('no-conversions');
    expect(r.z).toBeNull();
  });

  it('conversions above traffic is a broken input', () => {
    expect(twoProportionZTest(100, 140, 100, 20).verdict).toBe('invalid');
    expect(twoProportionZTest(-5, 1, 100, 20).verdict).toBe('invalid');
    expect(twoProportionZTest(Number.NaN, 1, 100, 20).verdict).toBe('invalid');
  });

  it('a losing arm is never reported as a win', () => {
    const r = twoProportionZTest(1000, 80, 1000, 50);
    expect(r.significant).toBe(true);
    expect(r.treatmentWins).toBe(false);
  });
});

// ─── 8. Seasonal forecast fitted against a known synthetic week ─────────────
function syntheticSeasonal(weeks: number) {
  const profile = [-25, -12, 5, 14, 30, 18, -40];
  const out: number[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    out.push(120 + 0.8 * i + profile[i % 7]);
  }
  return out;
}

describe('eval: holt-winters on a synthetic seasonal series', () => {
  const res = holtWinters(syntheticSeasonal(12), { seasonLength: 7, horizon: 7 });

  it('recognises the seasonality instead of flattening it', () => {
    expect(res.method).toBe('holt-winters');
    expect(res.seasonLength).toBe(7);
  });

  it('fits the known series to under ten percent error', () => {
    expect(res.mape).not.toBeNull();
    expect(res.mape ?? 100).toBeLessThan(10);
  });

  it('projects one point per day ahead', () => {
    expect(res.forecast).toHaveLength(7);
    expect(res.forecast.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
  });

  it('keeps the weekday ordering the series taught it', () => {
    // The synthetic week peaks on day 5 of the cycle and bottoms on day 7.
    const peak = res.forecast.indexOf(Math.max(...res.forecast));
    const bottom = res.forecast.indexOf(Math.min(...res.forecast));
    expect(peak).toBeLessThan(bottom);
  });

  it('refuses to invent a season from a handful of points', () => {
    expect(holtWinters([10, 12, 11], { seasonLength: 7 }).method).toBe('insufficient-data');
    expect(holtWinters([], { seasonLength: 7 }).method).toBe('insufficient-data');
  });

  it('falls back to a trend-only model when there is no season to find', () => {
    const flat = Array.from({ length: 30 }, (_, i) => 100 + i);
    const got = holtWinters(flat, { seasonLength: 7, horizon: 3 });
    expect(['double-exponential', 'holt-winters']).toContain(got.method);
    expect(got.forecast).toHaveLength(3);
  });
});

// ─── 9. Refusal contract: a shrug is not an answer ───────────────────────────
const FACTS = { tools: TOOL_CATALOG };

describe('eval: named-gap refusals', () => {
  const NAMING = [
    caseOf('no search phrases', ['ابعتلي كلمات البحث الحقيقية من جوجل', 'مش عندي وصول لكلمات البحث']),
    caseOf('no rivals', ['ارصد المنافسين النهاردة', 'ده خارج نطاق أدوات السرب دلوقتي']),
    caseOf('no publishing', ['انشر المسودة دي على الموقع', 'مقدرش أنشر من غير موافقتك']),
    caseOf('no factory eyes', ['كام قطعة في المخزن', 'مقدرش أقرأ المخزن']),
    caseOf('no messaging', ['ابعت رسالة واتساب للعميل ده', 'مش هقدر أبعت رسائل']),
  ];

  for (const { label, input } of NAMING) {
    const [message, reply] = input;
    it(`${label} names the missing capability`, () => {
      const note = explainGap(reply, message, FACTS);
      expect(note).toContain('الناقص:');
      expect(note).toContain('يتفعّل بـ:');
    });
  }

  it('a refusal that already named its variables is not decorated twice', () => {
    const reply = 'مش عندي كلمات بحث — ينقصني: GSC_SITE_URL';
    expect(explainGap(reply, 'كلمات البحث', FACTS)).toBe('');
  });

  it('an answer that already stated the scope boundary is not decorated twice', () => {
    expect(explainGap('المخزن خارج إطلالة الموقع', 'كام قطعة في المخزن', FACTS)).toBe('');
  });

  it('an honest measured answer gets no gap note', () => {
    const reply = 'فحصت 15 غرفة والمسودات المعلقة ثلاثة';
    expect(explainGap(reply, 'اللي بيبيع دلوقتي', FACTS)).toBe('');
  });

  it('a fabricated claim of work done is corrected, not gap-noted', () => {
    const note = explainGap('[إشعار] تنبيهات الطلبات — مفعّلة الآن', 'ابعت SMS للعملاء', FACTS);
    expect(note).toContain('تصحيح');
    expect(note).toContain('ما حصلش');
  });

  it('a tool that really ran is never corrected', () => {
    expect(explainGap('تم الإرسال', 'ابعت ملف العميل', FACTS, { executed: true })).toBe('');
  });

  it('an empty reply adds nothing', () => {
    expect(explainGap('', 'أي حاجة', FACTS)).toBe('');
  });

  it('the gap note never mixes latin into an arabic line', () => {
    for (const { input } of NAMING) {
      const note = explainGap(input[1], input[0], FACTS);
      for (const line of note.split('\n')) {
        const hasArabic = /[\u0600-\u06FF]/.test(line);
        const hasLatin = /[A-Za-z]/.test(line);
        expect(hasArabic && hasLatin).toBe(false);
      }
    }
  });
});

describe('eval: suite contract', () => {
  it('carries at least thirty golden decisions', () => {
    expect(GOLDEN_CASES).toBeGreaterThanOrEqual(30);
  });

  it('every catalog tool has an arabic description the model can read', () => {
    for (const tool of TOOL_CATALOG) {
      expect(tool.desc.length).toBeGreaterThan(8);
      expect(/[\u0600-\u06FF]/.test(tool.desc)).toBe(true);
    }
  });
});
