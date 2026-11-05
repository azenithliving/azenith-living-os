import { chromium } from "@playwright/test";

/**
 * Walk a customer page through every step and list the Latin words his screen actually carries.
 *   node scratch/drive-customer-steps.mjs [base]
 *
 * The first-pass census could only see step one: an option label or a stage sentence hides until the
 * customer gets there. This clicks forward and reads the visible text at every station.
 * Nothing is submitted — the last button of each page is left alone so no row is written.
 */
const BASE = process.argv[2] || "http://127.0.0.1:3000";
const ROUTES = process.argv[3]
  ? process.argv[3].split(",")
  : [
      "/request", "/start", "/furniture", "/rooms", "/",
      "/rooms/dining-room", "/rooms/living-room", "/rooms/bedroom",
      "/about", "/terms", "/privacy", "/elite-intelligence",
      "/seo/luxury-bedroom-design-cairo",
    ];
const NAV_WORDS = ["التالي", "السابق", "رجوع", "اترك", "أرسل", "واتساب", "احجز", "انتقل", "إرسال", "Next", "Back"];

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });

const scanVisible = async (page) =>
  page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    const found = [];
    for (const el of root.querySelectorAll("*")) {
      if (el.closest("a, code, pre, script, style")) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3)) continue;
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!t || (!/[A-Za-z]{3,}/.test(t) && !/\d/.test(t))) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || !el.getClientRects().length) continue;
      // Any visible text node counts. The first version only judged paragraphs, spans and Arabic-bearing
      // elements, which silently excused a Latin word written straight into a button.
      found.push(`${el.tagName}[${String(el.className).slice(0, 34)}] ${t.slice(0, 90)}`);
    }
    return [...new Set(found)];
  });

for (const route of ROUTES) {
  const page = await ctx.newPage();
  const seen = new Set();
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(6000);
    for (const t of await scanVisible(page)) seen.add(t);

    for (let station = 0; station < 8; station++) {
      // Answer the station: pick one option out of every button group, skipping navigation itself.
      const groups = await page.evaluate((nav) => {
        const root = document.querySelector("main") ?? document.body;
        const ids = [];
        root.querySelectorAll("button").forEach((btn, i) => {
          const t = (btn.textContent || "").trim();
          if (!t || t.length > 90) return;
          if (nav.some((w) => t.includes(w))) return;
          if (!btn.getClientRects().length) return;
          ids.push(i);
        });
        return ids;
      }, NAV_WORDS);
      for (const i of groups.slice(0, 24)) {
        const btn = page.locator("main button").nth(i);
        await btn.click({ timeout: 1500 }).catch(() => {});
      }
      await page.waitForTimeout(600);
      for (const t of await scanVisible(page)) seen.add(t);

      const next = page.getByRole("button", { name: /التالي|انتقل إلى الطلب/ }).first();
      if (!(await next.isVisible().catch(() => false))) break;
      await next.click().catch(() => {});
      await page.waitForTimeout(900);
      for (const t of await scanVisible(page)) seen.add(t);
    }
  } catch (err) {
    seen.add(`فشل: ${String(err?.message ?? err).slice(0, 70)}`);
  }
  const rows = [...seen];
  const words = rows.filter((r) => /[A-Za-z]{3,}/.test(r));
  const digits = rows.filter((r) => /\d/.test(r));
  console.log(`\n=== ${route} — لاتيني: ${words.length} سلسلة بكلمة · ${digits.length} سلسلة برقم`);
  for (const r of rows) console.log(`  ${/[A-Za-z]{3,}/.test(r) ? "كلمة" : /\d/.test(r) ? "رقم" : "—"} • ${r}`);
  await page.close();
}
await b.close();
