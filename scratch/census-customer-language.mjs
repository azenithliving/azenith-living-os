import { chromium } from "@playwright/test";

/**
 * What language the customer's pages actually speak, measured on the published store.
 *   node scratch/census-customer-language.mjs [base]
 *
 * Not judged from source: the store's own session default is Arabic, so the only honest question is
 * what lands on his customer's screen. Links and code spans are excluded — a web address is allowed.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const ROUTES = ["/", "/start", "/request", "/rooms", "/furniture", "/about", "/bookings"];

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });

for (const route of ROUTES) {
  const page = await ctx.newPage();
  let info = null;
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(7000);
    info = await page.evaluate(() => {
      const root = document.querySelector("main") ?? document.body;
      const clone = root.cloneNode(true);
      clone.querySelectorAll("a, code, pre, script, style").forEach((e) => e.remove());
      const text = clone.textContent || "";
      const words = text.match(/[A-Za-z][A-Za-z]{2,}/g) ?? [];
      const tally = new Map();
      for (const w of words) tally.set(w, (tally.get(w) ?? 0) + 1);
      return {
        lang: document.documentElement.lang || "(بلا)",
        dir: document.documentElement.dir || "(بلا)",
        chars: text.replace(/\s+/g, " ").trim().length,
        latin: words.length,
        top: [...tally.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([w, n]) => `${w}×${n}`).join(" "),
      };
    });
  } catch (err) {
    info = { lang: "?", dir: "?", chars: 0, latin: 0, top: `فشل: ${String(err?.message ?? err).slice(0, 60)}` };
  }
  console.log(`${route.padEnd(11)} لغة=${info.lang} اتجاه=${info.dir} · نصّ=${info.chars} حرف · كلمات لاتينية=${info.latin} · ${info.top}`);
  if (route === "/request") await page.screenshot({ path: "scratch/customer-language-request.png" });
  await page.close();
}
await b.close();
