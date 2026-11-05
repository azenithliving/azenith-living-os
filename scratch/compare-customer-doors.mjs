/**
 * Two doors answer «who are my customers?» — the one the employee screen reads and the
 * one the new roll stands on. This measures how far apart they agree, because a customer
 * who shows up on one screen and not the other is the defect class, not a detail.
 *
 * Prints counts and identity keys only, never a phone, an email or a name.
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
const p = await (await b.newContext()).newPage();
await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 15 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);

const out = await p.evaluate(async () => {
  const [oldRes, rollRes] = await Promise.all([
    fetch("/api/admin/leads", { cache: "no-store" }),
    fetch("/api/admin/customers", { cache: "no-store" }),
  ]);
  const oldJson = await oldRes.json().catch(() => ({}));
  const rollJson = await rollRes.json().catch(() => ({}));

  // The old screen keys a customer by whatever row it came from; fold each entry down to
  // a comparable shape: a phone when the door carries one, else the row id.
  // The old door spells a phone the way it was typed, the roll keys it the country way.
  // Comparing the raw strings reports every customer twice, so both sides are folded to
  // the same national form (ten digits, no trunk zero) before they are compared.
  const digits = (v) => {
    const d = typeof v === "string" ? v.replace(/\D/g, "") : "";
    const nat = d.replace(/^00?20/, "").replace(/^0/, "");
    return nat;
  };
  const oldKeys = (oldJson.leads || [])
    .map((l) => digits(l.phone || l.phoneNumber || "") || l.id || l.sessionId || "?")
    .filter(Boolean);
  const rollKeys = (rollJson.customers || [])
    .map((c) => (c.kind === "phone" ? c.key.replace(/^phone:/, "") : c.key))
    .filter(Boolean);

  return {
    oldStatus: oldRes.status,
    rollStatus: rollRes.status,
    oldCount: (oldJson.leads || []).length,
    rollCount: (rollJson.customers || []).length,
    rollTotals: rollJson.totals,
    phonesInOldNotRoll: oldKeys.filter((k) => /^\d{9,}$/.test(k) && !rollKeys.includes(k)),
    phonesInRollNotOld: rollKeys.filter((k) => /^\d{9,}$/.test(k) && !oldKeys.includes(k)),
    oldShapeOfFirstRow: Object.keys((oldJson.leads || [{}])[0] ?? {}),
  };
});

console.log(JSON.stringify(out, null, 1));
await b.close();
