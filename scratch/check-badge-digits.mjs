import fs from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The red count over the decisions door, read on the published cockpit at his width.
 *   node scratch/check-badge-digits.mjs [base]
 *
 * The badge only exists while decisions wait, so an empty queue is reported as such rather than
 * passing silently: the rule is «whatever number shows, it shows in his numerals».
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "").trim()])
);

let failed = false;
const say = (label, ok, detail = "") => {
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" })).newPage();

try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
  await page.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
  await page.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
  await page.click("button[type=submit]");
  for (let i = 0; i < 20 && !page.url().includes("/admin"); i += 1) await page.waitForTimeout(1500);
  say("signed in", page.url().includes("/admin"), page.url());

  await page.goto(`${BASE}/admin/v2/agents/ops?agent=ops-lead`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(9000);

  const badge = page.locator("[data-decisions-count]").first();
  const present = (await badge.count()) > 0;
  if (!present) {
    say("a badge is on screen to measure", false, "no waiting decisions right now — nothing to read");
  } else {
    const text = (await badge.innerText()).trim();
    say("the badge answers", text.length > 0, `«${text}»`);
    say("no Latin digits in it", !/[0-9]/.test(text), text);
    say("it is Arabic-Indic numerals", /[٠-٩]/.test(text), text);
  }
  await page.screenshot({ path: "scratch/badge-digits-phone.png", fullPage: false });
  console.log("screenshot: scratch/badge-digits-phone.png");
} catch (error) {
  say("the walk completed", false, String(error?.message || error).slice(0, 200));
} finally {
  await browser.close();
  if (failed) process.exitCode = 1;
}
