import fs from "node:fs";
import { chromium } from "@playwright/test";

/**
 * The library panel's colours, measured on the screen rather than in the class list.
 *   node scratch/check-panel-house.mjs [base]
 *
 * Signs in, opens the owner's home, and reads the computed colours of the panel's cards and its
 * outline button; then opens the public section preview, which is a light room and must stay one.
 * A control whose text colour equals its background colour is invisible, and that is what this
 * measures.
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

const luminance = (rgb) => {
  const parts = (rgb.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
  if (parts.length < 3) return -1;
  return (parts[0] * 0.299 + parts[1] * 0.587 + parts[2] * 0.114) / 255;
};

const readColours = () =>
  page.evaluate(() => {
    const pick = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, fg: s.color, border: s.borderColor, text: (el.textContent ?? "").trim().slice(0, 26) };
    };
    const logRow = [...document.querySelectorAll("a,button")].find((n) => n.textContent?.includes("سجلات"));
    const cards = [...document.querySelectorAll("div.rounded-xl")].filter((n) => n.className.includes("bg-panel"));
    return {
      house: Boolean(document.querySelector(".admin-house")),
      button: pick(logRow ?? null),
      cards: cards.slice(0, 3).map((n) => pick(n)),
    };
  });

try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL.trim());
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD.trim());
  await page.waitForFunction(() => {
    const b = document.querySelector('button[type="submit"]');
    return Boolean(b) && !b.disabled;
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

  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("div.bg-panel", { timeout: 60000 });
  const admin = await readColours();
  const adminButton = admin.button;
  const adminCards = admin.cards.filter(Boolean);
  console.log("admin house:", JSON.stringify({ house: admin.house, button: adminButton, cards: adminCards }, null, 1));

  await page.locator("div.bg-panel").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "scratch/panel-house-admin.png" });

  // The public section preview is a light room: the token pass must not have followed it.
  await page.goto(`${BASE}/preview/section/sofa`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const preview = await page.evaluate(() => {
    const el = document.querySelector("div.bg-panel");
    if (!el) return null;
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, fg: s.color };
  });
  console.log("public preview card:", JSON.stringify(preview));

  const buttonVisible = adminButton ? luminance(adminButton.bg) !== luminance(adminButton.fg) : false;
  const verdict = {
    houseCarried: admin.house,
    cardsDark: adminCards.length > 0 && adminCards.every((c) => luminance(c.bg) < 0.25),
    cardTextLight: adminCards.every((c) => luminance(c.fg) > 0.6),
    outlineButtonVisible: buttonVisible,
    previewStillLight: preview ? luminance(preview.bg) > 0.85 : true,
  };
  console.log("verdict:", JSON.stringify(verdict, null, 1));
  process.exitCode = Object.values(verdict).every(Boolean) ? 0 : 1;
} finally {
  await browser.close();
}
