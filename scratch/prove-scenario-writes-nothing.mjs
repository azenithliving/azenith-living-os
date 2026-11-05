/**
 * Does the scenario door still plant rows? Reads the two ledgers it used to write, fires
 * all three scenarios, and reads them again. The counts must not move.
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
const p = await (await b.newContext()).newPage();
await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(1500);

const out = await p.evaluate(async () => {
  const read = async () => (await (await fetch("/api/admin/agents/simulate-scenario", { cache: "no-store" })).json()).data;
  const before = await read();
  const fired = [];
  for (const scenarioKey of ["vip_custom_order", "stock_shortage_alert", "security_backup_sweep"]) {
    const res = await fetch("/api/admin/agents/simulate-scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioKey }),
    });
    const body = await res.json();
    fired.push({ scenarioKey, status: res.status, written: body.data?.written, steps: body.data?.steps?.length ?? 0 });
  }
  const after = await read();
  return { before, fired, after };
});

console.log("before:", JSON.stringify({ leads: out.before.leadsCount, orders: out.before.ordersCount, revenue: out.before.totalRevenue }));
for (const f of out.fired) console.log(`  ${f.scenarioKey}: ${f.status} · written=${f.written} · steps=${f.steps}`);
console.log("after: ", JSON.stringify({ leads: out.after.leadsCount, orders: out.after.ordersCount, revenue: out.after.totalRevenue }));
console.log(
  "nothing moved:",
  out.before.leadsCount === out.after.leadsCount &&
    out.before.ordersCount === out.after.ordersCount &&
    out.before.totalRevenue === out.after.totalRevenue,
);
await b.close();
