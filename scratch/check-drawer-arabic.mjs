import fs from "node:fs";
import { chromium } from "@playwright/test";

/**
 * The role labels the owner taps, read off the screen after opening the panel behind «أدوار».
 *   node scratch/check-drawer-arabic.mjs [base] [agentKey]
 *
 * The labels come from the role catalog; seven carried English machine words inside Egyptian
 * sentences. The leader's own list never contained them, so this reads the agent that does.
 */
const BASE = process.argv[2] || "http://127.0.0.1:3223";
const AGENT = process.argv[3] || "ops-content";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

try {
  await page.goto(BASE + "/gate/login", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL.trim());
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD.trim());
  await page.waitForFunction(() => {
    const b = document.querySelector('button[type="submit"]');
    return Boolean(b) && !b.disabled;
  }, null, { timeout: 40000 });
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  if ((await page.evaluate(() => document.body.innerText)).includes("التحقق بخطوتين")) {
    const { default: speakeasy } = await import("speakeasy");
    const code = speakeasy.totp({ secret: env.ADMIN_GATE_2FA_SECRET.trim().toUpperCase(), encoding: "base32" });
    await page.locator('input:not([type="hidden"])').last().fill(code);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4500);
  }

  await page.goto(BASE + "/admin/v2/agents/ops?agent=" + AGENT, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(4000);

  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /أدوار/.test(x.textContent ?? ""));
    if (!b) return false;
    b.click();
    return true;
  });
  await page.waitForTimeout(1500);

  const read = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      panelTitle: text.includes("أدوار وقدرات"),
      lines: text.split("\n").map((l) => l.trim()).filter((l) => /من نحن|نتائج البحث|الفخامة|البديل|مفاتيحك/.test(l)).slice(0, 6),
      latinInThoseLines: [...new Set(text.split("\n").filter((l) => /من نحن|نتائج البحث|الفخامة|البديل|مفاتيحك/.test(l)).join(" ").match(/[A-Za-z]{3,}/g) ?? [])],
    };
  });

  console.log("agent:", AGENT, "· roles button clicked:", opened);
  console.log(JSON.stringify(read, null, 1));
  await page.screenshot({ path: "scratch/drawer-arabic.png" });
} finally {
  await browser.close();
}
