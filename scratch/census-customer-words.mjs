import { chromium } from "@playwright/test";

/**
 * Every Latin word on a customer page, with the sentence it sits in, measured on the published store.
 *   node scratch/census-customer-words.mjs [base] [route]
 *
 * The aggregate count is not actionable; the owner needs to see which sentence carries the English.
 * Links and code spans are excluded — a web address is allowed on his screens.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const ROUTES = process.argv[3] ? [process.argv[3]] : ["/", "/start", "/request", "/rooms", "/furniture", "/about", "/bookings"];

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });

for (const route of ROUTES) {
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(7000);
    const hits = await page.evaluate(() => {
      const root = document.querySelector("main") ?? document.body;
      const clone = root.cloneNode(true);
      clone.querySelectorAll("a, code, pre, script, style").forEach((e) => e.remove());
      const out = [];
      const walk = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
      let n = walk.nextNode();
      while (n) {
        const t = (n.textContent || "").replace(/\s+/g, " ").trim();
        if (/[A-Za-z][A-Za-z]{2,}/.test(t)) out.push(t.slice(0, 130));
        n = walk.nextNode();
      }
      return out;
    });
    console.log(`\n=== ${route} — ${hits.length} سلسلة تحمل كلمة لاتينية`);
    for (const h of hits) console.log("  • " + h);
  } catch (err) {
    console.log(`\n=== ${route} فشل: ${String(err?.message ?? err).slice(0, 80)}`);
  }
  await page.close();
}
await b.close();
