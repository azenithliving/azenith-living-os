import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "node:fs";

/**
 * The number the owner reads, and the number his call button asks for — measured on the published
 * pre-call file.   node scratch/check-dossier-dial.mjs [base] [phone]
 *
 * The defect this exists for: the headline printed the store's internal key (no leading zero) and
 * the link was `tel:+20` + whatever the row held, so the two could disagree with the phone.
 */
const BASE = process.argv[2] ?? "https://azenith-living.vercel.app";
const PHONE = process.argv[3] ?? "01099999991";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "").trim()]),
);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 80)));

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i += 1) await p.waitForTimeout(1500);
console.log("داخل؟", p.url().includes("/admin") ? "أيوه" : "لأ", p.url());

await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(9000);
const search = p.locator("[data-dossier-search]").first();
await search.fill(PHONE);
await p.waitForTimeout(6000);
const pick = p.locator("[data-dossier-pick]").first();
if (await pick.count()) {
  await pick.click().catch(() => {});
  await p.waitForTimeout(11000);
}

const read = await p.evaluate(() => {
  const panel = document.querySelector("[data-dossier-panel]");
  const head = panel?.querySelector("[data-dossier-headline]");
  const call = panel?.querySelector("[data-dossier-call]");
  const wa = panel?.querySelector("[data-dossier-wa]") ?? panel?.querySelector("[data-dossier-whatsapp]");
  return {
    headline: (head?.textContent ?? "").replace(/\s+/g, " ").trim(),
    dial: call?.getAttribute("data-dossier-dial") ?? call?.getAttribute("href") ?? null,
    whatsapp: wa?.getAttribute("data-dossier-wa") ?? wa?.getAttribute("href") ?? null,
  };
});
await p.screenshot({ path: "scratch/dossier-dial.png" });
console.log("السطر كما يقرأه:", read.headline || "(فاضي)");
console.log("رقم الاتصال:", read.dial ?? "(مفيش زرار)");
console.log("رقم واتساب:", read.whatsapp ?? "(مفيش زرار)");
const codePoints = [...read.headline].filter((c) => /[\u0660-\u0669]/.test(c)).length;
console.log("أرقام عربية في السطر:", codePoints);
console.log("أخطاء الكونسول:", errors.length, errors.slice(0, 2).join(" | "));
await b.close();
