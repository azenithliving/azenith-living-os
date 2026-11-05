import fs from "node:fs";
import { chromium } from "@playwright/test";

/**
 * Does the quality panel on the owner's main screen actually load, and what does its door answer?
 *   node scratch/probe-quality-panel.mjs <base>
 *
 * Signs in the way the owner does, asks each candidate door directly, then opens the screen and
 * reads what the panel painted and which network calls it made. Nothing is written.
 *
 * Credentials are read from the environment and never printed.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const seen = [];
page.on("response", (res) => {
  if (res.url().includes("/api/admin/quality")) seen.push(`${res.status()} ${res.url().replace(BASE, "")}`);
});
page.on("console", (m) => {
  if (m.type() === "error") console.log("console error:", m.text().slice(0, 160));
});

try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL.trim());
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD.trim());
  await page.waitForFunction(
    () => {
      const button = document.querySelector('button[type="submit"]');
      return Boolean(button) && !button.disabled;
    },
    null,
    { timeout: 30000 }
  );
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
  if ((await page.evaluate(() => document.body.innerText)).includes("التحقق بخطوتين")) {
    const { default: speakeasy } = await import("speakeasy");
    const code = speakeasy.totp({ secret: env.ADMIN_GATE_2FA_SECRET.trim().toUpperCase(), encoding: "base32" });
    await page.locator('input:not([type="hidden"])').last().fill(code);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
  }

  // Only doors the screen actually opens. `/api/admin/quality-metrics` was a URL this project's own
  // notes invented on 2026-10-03; asking for it produces a 404 that means nothing.
  for (const path of ["/api/admin/quality?limit=100"]) {
    const answer = await page.evaluate(async (url) => {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      return { status: res.status, body: text.slice(0, 180) };
    }, path);
    console.log(`${path} → ${answer.status} · ${answer.body}`);
  }

  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(6000);
  const panel = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("div")].filter((d) => d.textContent?.trim() === "لا توجد فحوصات جودة بعد");
    const qualityHeading = [...document.querySelectorAll("h2,h3,p")].find((n) => /جودة|الجودة/.test(n.textContent ?? ""));
    const labels = ["ناجح", "فاشل", "مشروط", "نسبة النجاح", "مواد", "أثناء", "قبل تشطيب", "نهائي"];
    const numbers = labels
      .map((label) => {
        const node = [...document.querySelectorAll("p")].find((n) => n.textContent?.trim() === label);
        const value = node?.previousElementSibling?.textContent?.trim() ?? node?.parentElement?.querySelector("p")?.textContent?.trim();
        return value ? `${label}=${value}` : null;
      })
      .filter(Boolean);
    const total = [...document.querySelectorAll("p")].find((n) => n.textContent?.includes("إجمالي:"))?.textContent?.trim() ?? null;
    return {
      signedIn: !location.pathname.includes("gate"),
      emptyState: cards.length > 0,
      heading: qualityHeading?.textContent?.trim().slice(0, 60) ?? null,
      numbers,
      total,
      // The owner reads Arabic-Indic numerals: a Latin digit anywhere in this card is the defect.
      latinDigits: [...numbers, total ?? ""].filter((s) => /[0-9]/.test(s)),
      spinners: document.querySelectorAll(".animate-spin").length,
    };
  });
  console.log("the panel says:", JSON.stringify(panel, null, 1));
  console.log("quality calls the page made:", JSON.stringify(seen));
  // The card itself, not the top of the page: the digits have to be seen to be believed.
  const card = page.locator("p", { hasText: "نسبة النجاح" }).locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  if (await card.count()) {
    await card.first().screenshot({ path: "scratch/quality-card.png" });
  } else {
    await page.locator("text=إجمالي:").first().scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: "scratch/quality-card.png" });
  }
  await page.screenshot({ path: "scratch/quality-panel.png", fullPage: false });
} finally {
  await browser.close();
}
