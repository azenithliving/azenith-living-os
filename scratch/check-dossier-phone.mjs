import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "node:fs";

/**
 * The number the owner reads in his pre-call file, and the number he dials — on the published site.
 *   node scratch/check-dossier-phone.mjs [base] [phone]
 *
 * Reads only: the conversation this phone belongs to was filed by `check-chat-area.mjs`, so nothing
 * new is written here. The claim being measured is that the fact line «الموبايل» carries the trunk
 * zero like the headline and the call button, not the record's internal key.
 */
const BASE = process.argv[2] ?? "https://azenith-living.vercel.app";
const PHONE = process.argv[3] ?? "01088887766";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "").trim()]),
);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i += 1) await p.waitForTimeout(1500);

await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(9000);
await p.locator("[data-dossier-search]").first().fill(PHONE);
await p.waitForTimeout(7000);
const pick = p.locator("[data-dossier-pick]").first();
if (await pick.count()) {
  await pick.click().catch(() => {});
  await p.waitForTimeout(12000);
}

const read = await p.evaluate(() => {
  const panel = document.querySelector("[data-dossier-panel]");
  const text = (panel?.textContent ?? "").replace(/\s+/g, " ");
  const call = panel?.querySelector("[data-dossier-call]");
  return {
    headline: (panel?.querySelector("[data-dossier-headline]")?.textContent ?? "").replace(/\s+/g, " ").trim(),
    // The panel's help sentence also contains the word «الموبايل», so the fact line is found by its
    // digits, not by the label.
    fact: (text.match(/الموبايل\s*([\d\u0660-\u0669+]{6,})/) ?? [])[1] ?? null,
    dial: call?.getAttribute("href") ?? null,
    area: text.includes("منطقته من كلامه") ? "منطقته من كلامه: موجودة" : "مفيش سطر منطقة",
  };
});
const box = p.locator("[data-dossier-panel]").first();
if (await box.count()) {
  await box.scrollIntoViewIfNeeded().catch(() => {});
  await box.screenshot({ path: "scratch/dossier-phone.png" }).catch(() => {});
}
console.log("العنوان:", read.headline || "(فاضي)");
console.log("سطر الموبايل:", read.fact ?? "(مفيش)");
console.log("زرار الاتصال:", read.dial ?? "(مفيش)");
console.log(read.area);
console.log("أخطاء الكونسول:", errors.length);
await b.close();
