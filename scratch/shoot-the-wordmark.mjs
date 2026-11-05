import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import speakeasy from "speakeasy";

/** The header mark as it stands today, on the screen that still carries it. */
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
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: "ar-EG" });
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

await p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(12000);
const where = await p.evaluate(() => {
  const hit = [...document.querySelectorAll("span")].find((s) => s.textContent?.includes("AZENITH"));
  if (!hit) return null;
  const r = hit.getBoundingClientRect();
  return { text: hit.textContent.trim(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
});
console.log("الماركة:", JSON.stringify(where));
await p.screenshot({ path: `${OUT}/1-header.png`, clip: where ? { x: Math.max(0, where.x - 24), y: Math.max(0, where.y - 22), width: Math.min(1280, where.w + 60), height: 60 } : undefined });
copyFileSync(`${OUT}/1-header.png`, "scratch/decision-header.png");
await b.close();
