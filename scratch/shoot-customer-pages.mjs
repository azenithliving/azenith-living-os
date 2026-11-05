import { chromium } from "@playwright/test";

/**
 * The picture that goes with the number: the customer pages at 390px after the language patches.
 *   node scratch/shoot-customer-pages.mjs [base]
 */
const BASE = process.argv[2] || "http://127.0.0.1:3100";
const SHOTS = [
  ["/", "customer-after-home"],
  ["/request", "customer-after-request"],
  ["/start", "customer-after-start"],
  ["/furniture", "customer-after-furniture"],
];

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
for (const [route, name] of SHOTS) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  if (route === "/start") {
    // The budget chips only appear once the customer walks the steps forward.
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: /التالي/ }).first().click().catch(() => {});
      await page.waitForTimeout(700);
    }
  }
  await page.screenshot({ path: `scratch/${name}.png` });
  console.log(`${route} → scratch/${name}.png`);
  await page.close();
}
await b.close();
