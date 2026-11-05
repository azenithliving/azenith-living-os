/**
 * Does the owner's own chat still print markdown markers, or does it draw them now?
 *   node scratch/check-assistant-emphasis.mjs [base]
 *
 * Signs in through the store's own gate, opens the sales office where the employee's answer was
 * measured printing «**rows 0**», and reads what the thread actually rendered: how many words came
 * out bold, how many markers are still visible as text, and the first bold words it found.
 *
 * Credentials are read from the environment and never printed.
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] || "http://localhost:3222";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  if ((await page.evaluate(() => document.body.innerText)).includes("التحقق بخطوتين")) {
    const { default: speakeasy } = await import("speakeasy");
    const code = speakeasy.totp({ secret: env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").toUpperCase(), encoding: "base32" });
    await page.locator('input:not([type="hidden"])').last().fill(code);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
  }

  await page.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(9000);

  const read = await page.evaluate(() => {
    const bold = [...document.querySelectorAll('[data-emphasis="bold"]')].map((n) => n.textContent?.trim() ?? "");
    const em = [...document.querySelectorAll('[data-emphasis="em"]')].map((n) => n.textContent?.trim() ?? "");
    const body = document.body.innerText;
    // Any leftover marker, not just the double star: a half fix that clears `**` and leaves the
    // bullet star is how the first count of this check lied. The rendered dot is the product's
    // own bullet, so it is not counted as a marker.
    const MARKER = /\*\*|`|\]\(|^\s*[-+*]\s+|(?<=\s)\*\s+\S/;
    const starLines = body.split("\n").filter((l) => MARKER.test(l)).slice(0, 4);
    return { bold: bold.length, em: em.length, firstBold: bold.slice(0, 6), visibleMarkers: starLines };
  });

  console.log(`bold words drawn     : ${read.bold} · italic: ${read.em}`);
  console.log(`first bold words     : ${read.firstBold.join(" | ") || "—"}`);
  console.log(`lines still showing a marker: ${read.visibleMarkers.length}`);
  for (const line of read.visibleMarkers) console.log(`   ${line.slice(0, 140)}`);
  await page.screenshot({ path: "scratch/assistant-emphasis.png" });
} catch (err) {
  console.log("FAILED", String(err.message || err).slice(0, 200));
} finally {
  await browser.close();
}
