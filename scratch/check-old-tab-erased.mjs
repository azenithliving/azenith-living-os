/**
 * The old sales centre after its customers tab was erased: what rooms are left, and does
 * the old deep link still reach the moved employee.
 */
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "node:fs";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const BASE = process.argv.find((a) => a.startsWith("http")) || "http://localhost:3111";

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(1500);

await p.goto(`${BASE}/admin/sales`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(6000);
const body = await p.locator("body").innerText();
const rooms = ["مدير المبيعات", "العملاء", "المستأجرين", "الإدارة", "CMS"].filter((r) => body.includes(r));
console.log("rooms left in the old centre:", rooms.join(" · "));

await p.goto(`${BASE}/admin/sales?tab=leads&expand=phone%3A1005554444`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(9000);
console.log("the old customers link now lands on:", new URL(p.url()).pathname + new URL(p.url()).search);
const cards = await p.locator('div[class*="hover:bg-white/"]').count();
console.log("cards rendered there:", cards);
await p.screenshot({ path: "scratch/old-link-lands-in-the-office.png" });
await b.close();
