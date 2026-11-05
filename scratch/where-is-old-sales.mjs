/**
 * The owner's question: where is the old sales centre in the old dashboard? This walks the
 * real menu on the published site and prints the labels exactly as they appear, plus the
 * tabs the old sales page shows today.
 */
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "node:fs";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const BASE = process.argv.find((a) => a.startsWith("http")) || "https://azenith-living.vercel.app";

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();
await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(1500);

await p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(7000);
console.log("the old dashboard root lands on:", new URL(p.url()).pathname);

const links = await p.evaluate(() =>
  [...document.querySelectorAll("a[href^='/admin']")]
    .map((a) => `${(a.textContent || "").trim().replace(/\s+/g, " ")} → ${a.getAttribute("href")}`)
    .filter((x) => x.trim().length > 3)
);
console.log("menu items as he reads them:");
for (const l of [...new Set(links)].slice(0, 24)) console.log("  ", l);

await p.goto(`${BASE}/admin/sales`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(7000);
const tabs = await p.evaluate(() => {
  const btns = [...document.querySelectorAll("button")].map((b) => (b.textContent || "").trim().replace(/\s+/g, " "));
  return btns.filter((t) => t && t.length < 26).slice(0, 26);
});
console.log("tabs on the old sales page today:", [...new Set(tabs)].join(" · "));
await p.screenshot({ path: "scratch/old-sales-tabs.png" });
await b.close();
