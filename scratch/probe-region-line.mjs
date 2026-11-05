import { chromium } from "@playwright/test";
/** Prints the sentence the published sheet says its ranking stands on. */
const token = process.argv[2];
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(`https://azenith-living.vercel.app/passport/${token}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(9000);
console.log(await p.evaluate(() => {
  const el = document.querySelector("[data-region-line]");
  return el ? `${el.getAttribute("data-region-line")} — ${(el.textContent || "").trim()}` : "مفيش سطر";
}));
await b.close();
