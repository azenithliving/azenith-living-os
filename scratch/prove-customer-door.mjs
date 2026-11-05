import fs from "node:fs";
import { chromium } from "@playwright/test";
import sharp from "sharp";

/**
 * A stranger, a phone, a paper photo — and no admin login anywhere.
 *   node scratch/prove-customer-door.mjs [base]
 *
 * Proves the door that did not exist until 2026-10-07: the customer starts his own journey on the
 * published store, gets his private sheet address, and it opens as his sheet.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const PHONE = "01099999993";

const svg = `<svg width="900" height="620" xmlns="http://www.w3.org/2000/svg">
  <rect width="900" height="620" fill="#f7f4ec"/>
  <rect x="120" y="120" width="640" height="360" fill="none" stroke="#222" stroke-width="6"/>
  <text x="440" y="100" font-family="Arial" font-size="46" text-anchor="middle" fill="#111">5.10</text>
  <text x="300" y="530" font-family="Arial" font-size="46" text-anchor="middle" fill="#111">3.80</text>
</svg>`;
const paper = "scratch/paper-for-door.png";
await sharp(Buffer.from(svg)).png().toFile(paper);

let failed = false;
const say = (label, ok, detail = "") => {
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 120)));

try {
  await page.goto(`${BASE}/request`, { waitUntil: "domcontentloaded", timeout: 90000, headers: { "accept-language": "ar-EG,ar;q=0.9" } });
  await page.waitForTimeout(9000);

  const card = page.locator("[data-own-sheet-card]");
  say("الكارت موجود في صفحة الطلب", (await card.count()) > 0);

  // The card carries its own number field — it belongs to the customer, not to the form above it.

  const phoneBox = page.locator("[data-own-sheet-phone]").first();
  say("حقل الرقم موجود", (await phoneBox.count()) > 0);
  await phoneBox.fill(PHONE);
  say("الرقم اتكتب", (await phoneBox.inputValue()) === PHONE);

  await page.locator("[data-own-sheet-file]").setInputFiles(paper);
  await page.locator("[data-own-sheet-send]").click();

  let href = null;
  for (let i = 0; i < 24 && !href; i += 1) {
    await page.waitForTimeout(2500);
    const link = page.locator("[data-own-sheet-link] a").first();
    if (await link.count()) href = await link.getAttribute("href");
    const err = page.locator("[data-own-sheet-error]");
    if (await err.count()) {
      say("الباب ردّ", false, (await err.innerText()).slice(0, 120));
      break;
    }
  }
  const token = /\/passport\/([A-Za-z0-9_-]{20,32})$/.exec(href ?? "")?.[1] ?? null;
  say("عنوان سرّي طلع لعميل من غير دخول", Boolean(token), href ?? "مفيش لينك");
  await page.screenshot({ path: "scratch/customer-door-phone.png" });

  if (token) {
    await page.goto(String(href), { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(9000);
    const body = ((await page.locator("main").textContent().catch(() => "")) || "").replace(/\s+/g, " ");
    say("العنوان فتح ورقته فعلاً", /ورقة مقاساتك/.test(body), body.slice(0, 90));
    await page.screenshot({ path: "scratch/customer-door-sheet.png" });
  }

  say("كونسول نظيف", errors.length === 0, errors.slice(0, 2).join(" | "));
} catch (err) {
  say("المشي كامل", false, String(err?.message ?? err).slice(0, 180));
} finally {
  await b.close();
  if (failed) process.exitCode = 1;
}
