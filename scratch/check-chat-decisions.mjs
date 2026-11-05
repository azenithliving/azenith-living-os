import fs from "node:fs";
import { chromium } from "@playwright/test";

/**
 * What the owner's full-screen chat actually shows him: the unread separator, the decision card,
 * and whether a message that needs his word carries buttons where it sits.
 *   node scratch/check-chat-decisions.mjs [base]
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
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

  await page.goto(`${BASE}/admin/v2/agents/ops?agent=ops-lead`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3500);

  const seen = await page.evaluate(() => {
    const text = document.body.innerText;
    const separator = [...document.querySelectorAll("span")].find((s) => s.textContent?.trim() === "رسائل جديدة");
    const decisionButtons = ["وافقت", "ارفض", "أحسن"].filter((w) => text.includes(w));
    const vault = text.includes("قرارات بانتظار") || Boolean(document.querySelector("[data-decision-vault]"));
    return {
      messages: document.querySelectorAll("[data-message-id], [data-chat-message]").length,
      separator: Boolean(separator),
      separatorHasArrow: Boolean([...document.querySelectorAll("span")].find((s) => /رسائل جديدة\s*[↑↓]/.test(s.textContent ?? ""))),
      decisionButtons,
      vault,
      latinWords: [...new Set((text.match(/[A-Za-z][A-Za-z_.-]{3,}/g) ?? []))].slice(0, 12),
      tail: text.replace(/\s+/g, " ").slice(-260),
    };
  });

  console.log(JSON.stringify(seen, null, 1));
  await page.screenshot({ path: "scratch/chat-decisions.png" });
} finally {
  await browser.close();
}
