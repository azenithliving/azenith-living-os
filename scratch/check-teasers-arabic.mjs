import fs from "node:fs";
import { chromium } from "@playwright/test";

/**
 * Does the line under each employee's name read in Arabic to the man who reads Arabic?
 *   node scratch/check-teasers-arabic.mjs [base]
 *
 * Signs in the way the owner does, opens the cockpit, and reads the nine teaser lines off the
 * screen itself — not out of the door's JSON — because the card is the surface. A card with no
 * line is an honest outcome (its newest reply carried nothing he could read); a card with a
 * machine name in it is the defect.
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

try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
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

  await page.goto(`${BASE}/admin/v2`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("[data-employee-card]", { timeout: 60000 });
  await page.waitForFunction(
    () => !document.querySelector("[data-inboxes-loading]"),
    null,
    { timeout: 60000 }
  ).catch(() => {});
  await page.waitForTimeout(1500);

  const read = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-employee-card]")];
    return {
      cards: cards.length,
      lines: cards.map((card) => ({
        employee: card.querySelector("h3, [data-employee-name]")?.textContent?.trim().slice(0, 28) ?? "?",
        teaser: card.querySelector("p.line-clamp-2")?.textContent?.trim() ?? "",
      })),
      pageLatinWords: [...new Set((document.body.innerText.match(/[A-Za-z][A-Za-z_.-]{2,}/g) ?? []))].slice(0, 20),
    };
  });

  const bad = read.lines.filter((l) => /[A-Za-z0-9]/.test(l.teaser));
  for (const line of read.lines) {
    console.log(`${line.teaser ? (/[A-Za-z0-9]/.test(line.teaser) ? "LATIN" : "arabic") : "no line"} · ${line.employee} · ${line.teaser.slice(0, 78)}`);
  }
  console.log(JSON.stringify({ cards: read.cards, withLine: read.lines.filter((l) => l.teaser).length, carryingLatin: bad.length }, null, 1));
  console.log("Latin words anywhere on the screen:", JSON.stringify(read.pageLatinWords));
  await page.screenshot({ path: "scratch/teasers-arabic.png", fullPage: false });

  const verdict = { cardsPainted: read.cards >= 8, noLatinOnAnyCard: bad.length === 0 };
  console.log("verdict:", JSON.stringify(verdict));
  process.exitCode = Object.values(verdict).every(Boolean) ? 0 : 1;
} finally {
  await browser.close();
}
