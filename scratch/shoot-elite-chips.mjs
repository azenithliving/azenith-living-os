import { chromium } from "@playwright/test";

/**
 * A picture of the taste station with his answers on it — no submit, so no row.
 *   node scratch/shoot-elite-chips.mjs [base]
 */
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "https://azenith-living.vercel.app";
const TASTE = "مودرن";
const AREA = "التجمع";

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));
await page.goto(`${BASE}/elite-brief`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(9000);

// The screen's own words and direction, read out of the live page.
const chrome = await page.evaluate(() => ({
  direction: getComputedStyle(document.querySelector("main")).direction,
  eyebrow: document.querySelector("main p")?.textContent?.trim() ?? "",
  headline: document.querySelector("main h1")?.textContent?.trim() ?? "",
  firstButton: [...document.querySelectorAll("main button")]
    .filter((b) => b.getClientRects().length)
    .map((b) => (b.textContent || "").trim())
    .find((t) => t.length > 0) ?? "",
}));
console.log(`اتجاه الصفحة=${chrome.direction} · العنوان=${chrome.headline} · أول زرار=${chrome.firstButton}`);
await page.screenshot({ path: "scratch/elite-brief-arabic-top.png" });

for (let step = 1; step <= 3; step++) {
  await page.evaluate(() => {
    const card = document.querySelector("main div.rounded-2xl") ?? document.body;
    const groups = new Map();
    [...card.querySelectorAll("button")]
      .filter((btn) => btn.getClientRects().length)
      .filter((btn) => !/^(Continue|التالي|Back|رجوع)/i.test((btn.textContent || "").trim()))
      .forEach((btn) => {
        const key = `${btn.parentElement?.className ?? ""}#${(btn.parentElement?.previousElementSibling?.textContent ?? "").slice(0, 24)}`;
        if (!groups.has(key)) groups.set(key, btn);
      });
    groups.forEach((btn) => btn.click());
  });
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /Continue|التالي/ }).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

await page.locator(`[data-elite-taste-chip="${TASTE}"]`).click();
await page.locator(`[data-elite-area-chip="${AREA}"]`).click();
await page.waitForTimeout(700);
const state = await page.evaluate(
  ([taste, area]) => ({
    taste: document.querySelector(`[data-elite-taste-chip="${taste}"]`)?.getAttribute("data-elite-taste-chip-selected"),
    area: document.querySelector(`[data-elite-area-chip="${area}"]`)?.getAttribute("data-elite-area-chip-selected"),
    none: document.querySelector("[data-elite-taste-none]")?.getAttribute("class")?.includes("amber") ?? false,
  }),
  [TASTE, AREA],
);
console.log(`مختارة؟ ذوق=${state.taste} · منطقة=${state.area} · «مش محدد» لسه مضيئة=${state.none ? "أيوه" : "لأ"}`);

const card = page.locator("main div.rounded-2xl").first();
await card.screenshot({ path: "scratch/elite-chips-selected.png" });
console.log("صورة البطاقة: scratch/elite-chips-selected.png");
console.log(`أخطاء الكونسول: ${errors.length ? errors.join(" | ") : "صفر"}`);
await b.close();
