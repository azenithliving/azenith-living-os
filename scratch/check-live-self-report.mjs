/**
 * The published swarm reporting on itself: how many tools it really has now, and whether
 * any of the banned trades still appears in what it says it can do.
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
const BANNED = ["mfg_", "bom_calculate", "inventory_check_low", "inventory_update", "revenue_analyze", "revenue_opportunities", "financial_margins_analyze"];

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
  const res = await fetch("/api/admin/ops/self", { cache: "no-store" });
  return { status: res.status, text: await res.text() };
});

const hits = BANNED.filter((n) => out.text.includes(n));
console.log("self report status:", out.status);
console.log("banned trades still named in it:", hits.length ? hits.join(", ") : "none");
const count = /"tools"\s*:\s*(\d+)|(\d+)\s*أداة/.exec(out.text);
console.log("tool figure as the swarm states it:", count ? count[0] : "not a plain number in the text");
await b.close();
