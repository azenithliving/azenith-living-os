/**
 * Does the image library panel speak the owner's language on the published site?
 *   node scratch/check-image-panel.mjs [base]
 *
 * Logs in as the store's own admin, finds the library card at 390px, and reads back the digits
 * it actually paints, whether the 15,000 target sits beside the count, and whether the buckets
 * are named in Arabic or in machine keys. Credentials are read from the environment and never
 * printed.
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL.trim());
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD.trim());
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
  if ((await page.evaluate(() => document.body.innerText)).includes("التحقق بخطوتين")) {
    const code = speakeasy.totp({ secret: env.ADMIN_GATE_2FA_SECRET.trim().toUpperCase(), encoding: "base32" });
    await page.locator('input:not([type="hidden"])').last().fill(code);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4500);
  }

  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(9000);
  // The library panel sits far down the page; walk to it the way a thumb would.
  for (let i = 0; i < 12; i++) {
    const seen = await page.evaluate(() => document.body.innerText.includes("الصور النشطة"));
    if (seen) break;
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(1500);
  }
  const found = await page.evaluate(() => {
    const leaf = [...document.querySelectorAll("p,span,div,h1,h2,h3,h4")]
      .filter((n) => n.children.length === 0 && n.innerText?.includes("الصور النشطة"))
      .sort((a, b) => a.innerText.length - b.innerText.length)[0];
    if (!leaf) return { missing: true, hasWord: document.body.innerText.includes("الصور النشطة") };
    let card = leaf;
    for (let i = 0; i < 6 && card.parentElement; i++) {
      card = card.parentElement;
      if (card.innerText?.includes("عدد فعلي")) break;
    }
    card.scrollIntoView({ block: "center" });
    const wrap = card.parentElement?.parentElement ?? card;
    return {
      cardText: card.innerText.replace(/\s+/g, " ").slice(0, 220),
      blockText: wrap.innerText.replace(/\s+/g, " ").slice(0, 420),
    };
  });
  if (found.missing) {
    console.log("FAILED the library card was not found on the page");
  } else {
    const latin = (found.cardText.match(/[0-9]/g) || []).length;
    const arabicDigits = (found.cardText.match(/[\u0660-\u0669]/g) || []).length;
    console.log(`count card            : ${found.cardText}`);
    console.log(`digits painted        : arabic-indic=${arabicDigits} latin=${latin}`);
    console.log(`target beside it      : ${/هدف[\s\S]{0,8}١٥[٬,]?٠٠/.test(found.cardText) ? "yes" : "no"}`);
    console.log(`nearby blocks         : ${found.blockText}`);
    console.log(`machine keys visible  : ${/master-bedroom|comprehensive-interior|scandinavian/.test(found.blockText) ? "YES" : "no"}`);
  }
  // The agent status card on the same page: does it still print Latin digits or a machine key?
  const staff = await page.evaluate(() => {
    const leaf = [...document.querySelectorAll("p")]
      .filter((n) => n.children.length === 0 && n.innerText?.trim() === "مكتمل")
      .sort((a, b) => a.innerText.length - b.innerText.length)[0];
    if (!leaf) return { missing: true };
    const card = leaf.closest("div.rounded-2xl") ?? leaf.parentElement?.parentElement?.parentElement;
    return { text: (card?.innerText ?? "").replace(/\s+/g, " ").slice(0, 200) };
  });
  if (staff.text) {
    console.log(`staff card            : ${staff.text}`);
    console.log(`latin digits in card  : ${(staff.text.match(/[0-9]/g) || []).length}`);
    console.log(`machine key in card   : ${/OPS-|QAYYIM/i.test(staff.text) ? "YES" : "no"}`);
  }

  const shot = page.locator("text=الصور النشطة").first();
  if (await shot.count()) {
    await shot.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: "scratch/image-panel-live.png" });
} catch (err) {
  console.log("FAILED", String(err.message || err).slice(0, 200));
} finally {
  await browser.close();
}
