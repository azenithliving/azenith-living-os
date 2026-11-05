import { chromium } from "@playwright/test";

/**
 * Does the elite flow say the store's hours once?
 *   node scratch/check-elite-hours-card.mjs [base]
 *
 * The screen used to render its own status card above the brief's: the same schedule, twice, in two
 * voices — one of them a translation («فريق الاستشارات يستعد للإبداع») that no customer of this
 * store reads. This counts what is actually on the screen.
 */
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "https://azenith-living.vercel.app";
const STORE_VOICE = "فريقنا دلوقتي بيشتغل على مشاريعه";
const TRANSLATED = "فريق الاستشارات يستعد للإبداع";

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));

await p.goto(`${BASE}/elite-intelligence`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(10000);

const found = await p.evaluate(
  ([store, translated]) => {
    const text = document.body.innerText;
    const count = (needle) => text.split(needle).length - 1;
    return { store: count(store), translated: count(translated), headline: document.querySelector("main h1")?.textContent?.trim() ?? "" };
  },
  [STORE_VOICE, TRANSLATED],
);

console.log(`العنوان: ${found.headline}`);
console.log(`كارت المتجر («بيشتغل على مشاريعه»): ${found.store} · الكارت المترجم («يستعد للإبداع»): ${found.translated}`);
console.log(found.store === 1 && found.translated === 0 ? "=> مرة واحدة وبصوت المتجر" : "=> لسه مكرر أو ناقص");
await p.screenshot({ path: "scratch/elite-hours-once.png" });
console.log(`أخطاء الكونسول: ${errors.length ? errors.join(" | ") : "صفر"}`);
await b.close();
