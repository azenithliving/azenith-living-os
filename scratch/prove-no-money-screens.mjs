/**
 * Proof that the money domain really left the owner's screens: the customers screen is
 * loaded and searched for the phrases that used to show amounts, and the door that used to
 * attach an order to a customer is probed to confirm it no longer exists.
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
const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(1500);

await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(9000);
// Open every card, so a hidden amount inside a collapsed row cannot slip past.
const cards = await p.locator('div[class*="cursor-pointer"]').count();
for (let i = 0; i < cards; i++) {
  await p.evaluate((n) => {
    const rows = [...document.querySelectorAll('div[class*="cursor-pointer"]')];
    rows[n]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }, i);
  await p.waitForTimeout(400);
}
await p.waitForTimeout(1200);

const body = await p.locator("body").innerText();
const door = await p.evaluate(async () => {
  const res = await fetch("/api/admin/customers/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  return res.status;
});

console.log("cards on screen:", (body.match(/الميزانية:/g) || []).length ? "list rendered" : "?", "| rows clicked:", cards);
console.log("amount box present:", /أوامر بيع لسه مربوطش بعميل/.test(body));
console.log("money line present:", /حسابه عندك/.test(body));
console.log("any currency figure present:", /ج\s*$|[0-9]{3},[0-9]{3}/m.test(body));
console.log("the attach door answers:", door);
await p.screenshot({ path: "scratch/no-money-on-customers.png" });
await b.close();
