import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import speakeasy from "speakeasy";

/**
 * Two pictures for the owner's two open decisions: the header mark on his admin screen, and the
 * preview page that reads a table the database says does not exist.
 */
const BASE = "https://azenith-living.vercel.app";
const OUT = "C:/Users/noura/Pictures/qarar";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);

await p.goto(`${BASE}/admin/v2/ops`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(12000);
await p.screenshot({ path: `${OUT}/1-header.png` });
const header = await p.evaluate(() => {
  const el = document.querySelector("header") ?? document.body;
  return el.innerText.replace(/\s+/g, " ").slice(0, 160);
});
console.log("نص الهيدر كما هو: «" + header + "»");

await p.goto(`${BASE}/preview/section/00000000-0000-0000-0000-000000000000`, {
  waitUntil: "domcontentloaded",
  timeout: 90000,
});
await p.waitForTimeout(8000);
await p.screenshot({ path: `${OUT}/2-preview.png` });
console.log("صفحة المعاينة:", await p.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 200)));
console.log("الرابط:", p.url());

copyFileSync(`${OUT}/1-header.png`, "scratch/decision-header.png");
copyFileSync(`${OUT}/2-preview.png`, "scratch/decision-preview.png");
await b.close();
