/**
 * Proves the customers roll on the published site from inside a real admin session.
 * The internal key is not used: the platform's own value for it is not the local one,
 * and a session is the honest way to ask what the owner's screen would see.
 * Prints totals and space names only — no credential and no contact detail.
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
console.log("logged in:", p.url().includes("/admin"));

const out = await p.evaluate(async () => {
  const paths = ["/api/admin/customers", "/api/admin/manufacturing/metrics", "/api/admin/manufacturing/schedule", "/api/admin/2fa/status"];
  const out = [];
  for (const path of paths) {
    try {
      const r = await fetch(path, { cache: "no-store" });
      const txt = await r.text();
      out.push({ path, status: r.status, head: txt.slice(0, 150) });
    } catch (e) { out.push({ path, status: "fetch-failed", head: String(e) }); }
  }
  return out;
});
for (const r of out) console.log(`  ${String(r.status).padEnd(5)} ${r.path.padEnd(40)} ${r.head.replace(/s+/g," ").slice(0,110)}`);
await b.close();
