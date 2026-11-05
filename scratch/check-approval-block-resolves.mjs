import fs from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Does every decision block in the chat actually resolve?
 *   node scratch/check-approval-block-resolves.mjs [base]
 *
 * A screenshot taken while proving the badge digits showed a block still reading «بقرا الاقتراح…»
 * nine seconds after the page opened. A spinner that never ends is worse than no buttons at all: it
 * looks like the store is thinking when the queue read already answered — or failed. So: open the
 * cockpit, wait, and print what every block on screen ended up saying.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "").trim()])
);

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" })).newPage();
const calls = [];
page.on("response", async (res) => {
  if (res.url().includes("approval-queue")) calls.push({ status: res.status(), ok: res.ok() });
});

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

  await page.goto(`${BASE}/admin/v2/agents/ops?agent=ops-lead`, { waitUntil: "domcontentloaded", timeout: 90000 });

  for (const seconds of [9, 20, 30]) {
    await page.waitForTimeout(seconds * 1000);
    const blocks = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-approval-block]")).map((el) => ({
        id: el.getAttribute("data-approval-block"),
        text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
        buttons: el.querySelectorAll("[data-approval-decision]").length,
      }))
    );
    console.log(`--- after ${seconds}s: ${blocks.length} block(s), queue reads: ${JSON.stringify(calls)}`);
    for (const b of blocks) console.log(`    ${String(b.id).slice(0, 8)}… buttons=${b.buttons} «${b.text}»`);
    if (blocks.length && blocks.every((b) => !b.text.includes("بقرا"))) {
      console.log("VERDICT: every block resolved");
      break;
    }
    if (seconds === 30) console.log("VERDICT: at least one block is still spinning after 30s");
  }
} catch (error) {
  console.log("FAILED", String(error?.message || error).slice(0, 200));
} finally {
  await browser.close();
}
