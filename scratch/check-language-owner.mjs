import { chromium } from "@playwright/test";

/**
 * One owner for the language: does the setting travel between the two elite screens?
 *   node scratch/check-language-owner.mjs [base]
 *
 * Before this fix the flow screen kept a private copy of the language and guessed from the browser,
 * so the header switcher and the address could be overruled page by page. These are the three paths
 * a real customer takes, read out of the live page.
 */
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://127.0.0.1:3717";
const AR = "صمم رؤيتك";
const EN = "Design Your Vision";

const b = await chromium.launch({ headless: true });
const results = [];

async function open(lang) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: lang });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 80)));
  return { ctx, page, errors };
}

const heading = (page) =>
  page.evaluate(() => document.querySelector("main h1")?.textContent?.trim() ?? "(مفيش عنوان)");
const direction = (page) => page.evaluate(() => getComputedStyle(document.querySelector("main")).direction);

// 1 — a fresh Egyptian visitor: the store's floor is Arabic, on both screens.
{
  const { page, errors } = await open("ar-EG");
  await page.goto(`${BASE}/elite-brief`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  const brief = await heading(page);
  await page.goto(`${BASE}/elite-intelligence`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  const flow = await heading(page);
  await page.screenshot({ path: "scratch/lang-fresh-arabic.png" });
  results.push({ case: "زائر جديد (متصفح عربي)", brief, flow, dir: await direction(page), errors: errors.length });
  await page.close();
}

// 2 — the address says English on the brief: the other screen must agree, not flip back.
{
  const { page, errors } = await open("ar-EG");
  await page.goto(`${BASE}/elite-brief?lang=en`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  const brief = await heading(page);
  await page.goto(`${BASE}/elite-intelligence`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  const flow = await heading(page);
  results.push({ case: "الرابط يقول إنجليزي", brief, flow, dir: await direction(page), errors: errors.length });
  await page.close();
}

// 3 — he switches on the flow screen: the brief must follow him there.
{
  const { page, errors } = await open("ar-EG");
  await page.goto(`${BASE}/elite-intelligence`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  const before = await heading(page);
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((el) => /English/.test(el.textContent || ""));
    if (!btn) return "ما اتلاقيش زرار اللغة";
    btn.click();
    return "اتضغط";
  });
  await page.waitForTimeout(4000);
  const after = await heading(page);
  await page.goto(`${BASE}/elite-brief`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  const brief = await heading(page);
  await page.screenshot({ path: "scratch/lang-switched-english.png" });
  results.push({ case: `زرار اللغة (${clicked})`, brief: `${before} ← المسار، و${after} بعد الضغط`, flow: brief, dir: await direction(page), errors: errors.length });
  await page.close();
}

console.log("=== الشاشة بتتكلم لغة واحدة في كل المسار");
for (const r of results) {
  const ok = (s) => (s.includes(AR) ? "عربي" : s.includes(EN) ? "إنجليزي" : s);
  console.log(`- ${r.case}: كراسة النخبة=${ok(r.brief)} · مسار النخبة=${ok(r.flow)} · اتجاه=${r.dir} · أخطاء=${r.errors}`);
}
await b.close();
