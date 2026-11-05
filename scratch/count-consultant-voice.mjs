/**
 * How does the advisor's reply actually look on the customer's phone?
 *   node scratch/count-consultant-voice.mjs [base] [n]
 *
 * Asks real shopper questions through the consultant's own door and counts five things in what
 * comes back: raw markdown symbols, market-talk (speaking ABOUT the trade in Egypt instead of AS
 * this shop), a store denial, a cut denial (the guard repaired it), and a cut referral.
 *
 * The guards' own patterns are imported from the product, not copied here: node runs the .ts
 * straight, so this probe cannot drift from the net it is measuring — which is how two earlier
 * counters reported a false zero. Only MARKET_TALK is probe-owned, because nothing in the
 * product enforces it yet; that number is a measurement, not a control.
 *
 * Baseline on the published store before the fix, 2026-10-02: MARKDOWN 2 of 6, and three of the
 * six never reached a model at all — the price net took «شقة ١٨٠ متر», the escalation net took
 * «الخشب الجيد والوحش», and the food net took «من أول ما أكلمكم».
 */
import { chromium } from '@playwright/test';
import { IDENTITY_DENIAL, IDENTITY_LINE, denialSentences } from '../lib/consultant/identity-voice.ts';
import { AWAY_REFERRAL, referralSentences } from '../lib/consultant/customer-voice.ts';

const BASE = process.argv[2] || 'https://azenith-living.vercel.app';
const N = Number(process.argv[3] || 6);

/** Raw markdown that a plain-text chat bubble prints as symbols in the customer's face. */
const MARKDOWN = /(\*\*[^*\n]+\*\*|^\s{0,3}#{1,6}\s|(?<=\s)#{1,6}\s|^\s*[-*+]\s+\S|(?<=\s)[*+]\s+\S|`|\]\()/m;

/** Probe-owned: the advisor generalising about the trade instead of speaking as Azenith. */
const MARKET_TALK =
  /(?:سوق|العرف|عرف|عادة|غالبا|معظم|أغلب|كثير من)[^.!؟?\n]{0,40}(?:المقاولات|التشطيبات|الموبيليا|الأثاث|الورش|المصانع|الشركات|المحلات|التجار|الناس|المصممين|البيوت|العملاء|السائد|في مصر)|السوق\s+(?:المصري|المصرية)|في\s+مصر\s+عادة|(?:الشركات|الورش|المصانع|المقاولين)\s+(?:عادة|بتعمل|تعمل|بيعملوا)/i;

/**
 * A Latin run inside an Arabic line scrambles the reading direction on the customer's phone.
 * A gloss is the parenthesised translation the model likes to append: «المنحنية (Curved)».
 */
const GLOSS = /\([^)]*[A-Za-z]{2,}[^)]*\)/;
const LATIN_RUN = /\p{Script=Latin}\w*/gu;

const QUESTIONS = [
  'قولي إيه خطوات الشغل معاكم من أول ما أكلمكم لحد ما الأثاث يوصل؟',
  'إيه الفرق بين الركنة المودرن والكلاسيك، وأيه أنسب لشقة ١٨٠ متر؟',
  'إزاي أختار خامات النيش والمطبخ؟ عايز أعرف أفرّق بين الخشب الجيد والوحش.',
  'عايز أعرف عندكم ركن مودرن للصة؟',
  'بتشتغلوا في التجمع ولا القاهرة الجديدة بس؟ ومين اللي بينفّذ الشغل؟',
  'لو معايا ميزانية محدودة لشقة ١٢٠ متر، تنصحني أبدأ بإيه؟',
];

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();

try {
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(3000);
  let markdown = 0;
  let market = 0;
  let denied = 0;
  let repaired = 0;
  let referral = 0;
  let gloss = 0;
  let bare = 0;
  let asked = 0;
  for (let i = 0; i < Math.min(N, QUESTIONS.length); i++) {
    const q = QUESTIONS[i];
    const res = await p.evaluate(async ({ question }) => {
      const r = await fetch('/api/consultant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, language: 'ar' }),
      });
      const j = await r.json().catch(() => ({}));
      return { status: r.status, reply: String(j.reply ?? j.error ?? '') };
    }, { question: q });
    asked++;
    const hitMarkdown = MARKDOWN.test(res.reply);
    const hitMarket = MARKET_TALK.test(res.reply);
    const hitDenial = IDENTITY_DENIAL.test(res.reply);
    const wasRepaired = res.reply.includes(IDENTITY_LINE.ar);
    const hitReferral = AWAY_REFERRAL.test(res.reply);
    const isArabic = /\p{Script=Arabic}/u.test(res.reply);
    const hitGloss = isArabic && GLOSS.test(res.reply);
    const bareRuns = isArabic
      ? (res.reply.replace(/\([^)]*\)/g, " ").match(LATIN_RUN) || []).filter((w) => w.length > 1)
      : [];
    if (hitMarkdown) markdown++;
    if (hitMarket) market++;
    if (hitDenial) denied++;
    if (wasRepaired) repaired++;
    if (hitReferral) referral++;
    if (hitGloss) gloss++;
    if (bareRuns.length) bare++;
    console.log(`${i + 1}. ${q}`);
    console.log(
      `   ${res.status} markdown=${hitMarkdown ? 'YES' : 'no'} market=${hitMarket ? 'YES' : 'no'} denial=${hitDenial ? 'YES' : 'no'} repaired=${wasRepaired ? 'YES' : 'no'} referral=${hitReferral ? 'YES' : 'no'} gloss=${hitGloss ? 'YES' : 'no'} bare=${bareRuns.length ? bareRuns.join(',') : 'no'}`
    );
    console.log(`   ${res.reply.replace(/\s+/g, ' ').slice(0, 220)}`);
    if (hitMarket) {
      const m = res.reply.match(MARKET_TALK);
      const at = m?.index ?? 0;
      console.log(`   market-talk: …${res.reply.slice(Math.max(0, at - 40), at + 70).replace(/\s+/g, ' ')}…`);
    }
    if (hitDenial) {
      console.log(`   denial still visible: ${denialSentences(res.reply).map((s) => s.slice(0, 120)).join(' | ')}`);
    }
    if (hitReferral) {
      console.log(`   referral still visible: ${referralSentences(res.reply).map((s) => s.slice(0, 120)).join(' | ')}`);
    }
  }
  console.log(
    `MARKDOWN ${markdown} of ${asked} · MARKET ${market} of ${asked} · DENIAL ${denied} of ${asked} · REPAIRED ${repaired} of ${asked} · REFERRAL ${referral} of ${asked} · GLOSS ${gloss} of ${asked} · BARE-LATIN ${bare} of ${asked}`
  );
} catch (e) {
  console.log('FAILED', String(e.message || e).slice(0, 200));
} finally {
  await b.close();
}
