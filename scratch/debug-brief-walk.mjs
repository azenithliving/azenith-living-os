import { chromium } from "@playwright/test";
/** Prints where the brief walk stands, step by step. Read-only. */
const b = await chromium.launch({ headless: true });
const page = await b.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("https://azenith-living.vercel.app/request", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(9000);
for (let round = 1; round <= 6; round++) {
  const state = await page.evaluate(() => {
    const form = document.querySelector("main form");
    const heading = [...document.querySelectorAll("main h3")].map((h) => (h.textContent || "").trim()).filter(Boolean)[0] ?? "";
    const buttons = form ? [...form.querySelectorAll("button")].filter((x) => x.getClientRects().length).map((x) => (x.textContent || "").replace(/\s+/g, " ").trim().slice(0, 26)) : [];
    return { hasForm: Boolean(form), heading, buttons: buttons.slice(0, 12), count: buttons.length, chip: Boolean(document.querySelector("[data-lead-area]")) };
  });
  console.log(`دورة ${round}: عنوان=${state.heading.slice(0, 40)} · فورم=${state.hasForm} · أزرار ظاهرة=${state.count} · شارة=${state.chip ? "أيوه" : "لأ"}`);
  console.log(`   ${state.buttons.join(" | ")}`);
  if (state.chip) break;
  const clicked = await page.evaluate(() => {
    const form = document.querySelector("main form");
    if (!form) return 0;
    const nav = ["التالي", "السابق", "حفظ كراسة الشروط"];
    const visible = [...form.querySelectorAll("button")].filter((x) => x.getClientRects().length && !nav.includes((x.textContent || "").trim()));
    visible.slice(0, 6).forEach((x) => x.click());
    return visible.length;
  });
  console.log(`   ضغطت ${clicked} زر اختيار`);
  await page.waitForTimeout(1200);
  const next = page.getByRole("button", { name: "التالي" });
  if (await next.count()) { await next.first().click().catch(() => {}); await page.waitForTimeout(1500); }
}
await b.close();
