import { chromium } from "@playwright/test";
/** Polls the published sheet until the badge names the tier that ordered the list. */
const token = process.argv[2] || "AQW-T6YVjqDGhwP7gKaO-1bw";
const b = await chromium.launch({ headless: true });
for (let i = 0; i < 14; i++) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(`https://azenith-living.vercel.app/passport/${token}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(9000);
  const out = await p.evaluate(() => document.querySelector("[data-picture-near]")?.textContent?.trim() ?? "ولا علامة");
  await p.close();
  console.log(`محاولة ${i + 1}: العلامة = ${out}`);
  if (out.includes("ذوق منطقتك")) { await b.close(); process.exit(0); }
  await new Promise((r) => setTimeout(r, 45000));
}
await b.close();
process.exit(1);
