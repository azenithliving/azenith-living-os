import fs from "node:fs";
import { chromium } from "@playwright/test";

/**
 * How many doors does the cockpit open to paint nine badges, and when do the badges actually land?
 *   node scratch/check-inboxes-speed.mjs [base]
 *
 * Signs in the way the owner does, opens the swarm screen, and counts the message reads the page
 * makes while timing the moment the first card stops looking empty. Nothing is written.
 *
 * Credentials are read from the environment and never printed.
 */
const BASE = process.argv[2] || "http://localhost:3223";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const messageReads = [];
const inboxReads = [];
page.on("request", (req) => {
  if (req.url().includes("/api/admin/agents/messages")) messageReads.push(req.url().slice(-40));
  if (req.url().includes("/api/admin/agents/inboxes")) inboxReads.push(req.url().slice(-60));
});

try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL.trim());
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD.trim());
  await page.waitForFunction(() => {
    const button = document.querySelector('button[type="submit"]');
    return Boolean(button) && !button.disabled;
  }, null, { timeout: 30000 });
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
  if ((await page.evaluate(() => document.body.innerText)).includes("التحقق بخطوتين")) {
    const { default: speakeasy } = await import("speakeasy");
    const code = speakeasy.totp({ secret: env.ADMIN_GATE_2FA_SECRET.trim().toUpperCase(), encoding: "base32" });
    await page.locator('input:not([type="hidden"])').last().fill(code);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
  }

  const started = Date.now();
  await page.goto(`${BASE}/admin/v2`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("[data-employee-card]", { timeout: 60000 });
  const cardsAt = Date.now() - started;

  // The honest in-flight line: it exists while the read is coming, and it is gone once it lands.
  const loadingSeen = await page.locator("[data-inboxes-loading]").count();
  await page.waitForFunction(
    () => document.querySelectorAll("[data-employee-card] p.line-clamp-2").length > 0 || !document.querySelector("[data-inboxes-loading]"),
    null,
    { timeout: 60000 }
  ).catch(() => {});
  const filledAt = Date.now() - started;
  const state = await page.evaluate(() => ({
    cards: document.querySelectorAll("[data-employee-card]").length,
    teasers: document.querySelectorAll("[data-employee-card] p.line-clamp-2").length,
    loading: document.querySelectorAll("[data-inboxes-loading]").length,
    badges: [...document.querySelectorAll("[data-employee-card] span.animate-pulse")].map((n) => n.textContent?.trim()),
    pulse: [...document.querySelectorAll('[aria-label="نبض المتجر"] div.grid > div')].map((n) => n.innerText.replace(/\s+/g, " ").trim()),
    serverWord: document.body.innerText.includes("السيرفر"),
  }));
  console.log(`cards painted at ${cardsAt}ms · badges/teasers filled at ${filledAt}ms`);
  console.log(`per-employee message reads: ${messageReads.length} · batched inbox reads: ${inboxReads.length}`);
  console.log("the screen:", JSON.stringify(state, null, 1));
  await page.screenshot({ path: "scratch/inboxes-after.png", fullPage: false });

  const verdict = {
    oneDoorForNineBadges: messageReads.length === 0 && inboxReads.length <= 1,
    cardsFilled: state.teasers > 0,
    noServerWord: !state.serverWord,
    pulseLandedInHisDigits: state.pulse.some((line) => /[٠-٩]/.test(line)),
  };
  console.log("verdict:", JSON.stringify(verdict, null, 1));
  process.exitCode = Object.values(verdict).every(Boolean) ? 0 : 1;
} finally {
  await browser.close();
}
