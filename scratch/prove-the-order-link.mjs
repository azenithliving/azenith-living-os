/**
 * Proof of the order link, measured against the live data — and put back exactly as found.
 *
 * The owner decides whose order is whose; this only shows the door can carry that decision
 * and undo it. It counts before, links one order to one profile, counts again, unlinks, and
 * confirms the ledger is back where it started.
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
await p.waitForTimeout(8000);
await p.screenshot({ path: "scratch/unowned-orders-block.png" });

const out = await p.evaluate(async () => {
  const read = async () => {
    const j = await (await fetch("/api/admin/leads", { cache: "no-store" })).json();
    return {
      customers: (j.leads || []).length,
      unowned: (j.unownedOrders || []).map((o) => ({ id: o.id, quoted: o.quoted })),
      money: (j.leads || []).map((l) => ({ id: l.id, quoted: l.money?.quoted ?? 0 })),
      withProfile: (j.leads || []).filter((l) => (l.profile_ids?.length ?? 0) > 0),
    };
  };
  const post = async (orderId, userId) => {
    const res = await fetch("/api/admin/customers/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, userId }),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  const before = await read();
  const order = before.unowned.slice().sort((a, b) => b.quoted - a.quoted)[0];
  const target = before.withProfile[0];
  if (!order || !target) return { skipped: true, before: { customers: before.customers, unowned: before.unowned.length } };

  const linked = await post(order.id, target.profile_ids[0]);
  const middle = await read();
  const unlinked = await post(order.id, null);
  const after = await read();

  return {
    skipped: false,
    beforeCustomers: before.customers,
    beforeUnowned: before.unowned.length,
    linkStatus: linked.status,
    customersWhileLinked: middle.customers,
    unownedWhileLinked: middle.unowned.length,
    moneyOnThatCustomerWhileLinked: middle.money.find((m) => m.id === target.id)?.quoted ?? null,
    moneyOnThatCustomerBefore: before.money.find((m) => m.id === target.id)?.quoted ?? null,
    unlinkStatus: unlinked.status,
    customersAfter: after.customers,
    unownedAfter: after.unowned.length,
    refusedBogusId: (await post("1; drop table sales_orders", null)).status,
    refusedGhostCustomer: (await post(order.id, "00000000-0000-0000-0000-000000000000")).status,
  };
});

console.log(JSON.stringify(out, null, 1));
await b.close();
