/**
 * End-to-end proof of the link that was missing: a visitor gives the consultant a
 * phone number on the live site, and the customers roll must show that conversation
 * attached to a customer instead of floating on its own.
 *
 * Prints the session id, the counts and the identity kind only — no contact detail.
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
const sessionId = `proof-${Date.now()}`;
// A number from the reserved test range, so the proof cannot reach a real subscriber.
const message = "السلام عليكم، أنا تجربي للربط ورقمي 01005554444 عشان تتواصلوا معايا";

const before = await (await fetch(`${BASE}/api/consultant`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  // The door takes a single `message` plus optional history — sending `messages`
  // returns 400 and proves nothing, which is what the first run of this did.
  body: JSON.stringify({ sessionId, message }),
})).text();
console.log("consultant answered:", before.slice(0, 120));
await new Promise((r) => setTimeout(r, 8000));

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

const out = await p.evaluate(async (sid) => {
  const r = await fetch("/api/admin/customers", { cache: "no-store" });
  const j = await r.json();
  const found = (j.customers || []).find((c) => c.key === "phone:1005554444");
  const s = await fetch(`/api/consultant?sessionId=${sid}`).then((x) => x.json()).catch(() => null);
  return {
    status: r.status,
    totals: j.totals,
    found: found ? { kind: found.kind, spaces: found.spaces, name: found.name ? "yes" : "no" } : null,
    sessionSaved: Boolean(s?.messages?.length ?? s?.session),
  };
}, sessionId);

console.log("roll status:", out.status);
console.log("totals:", JSON.stringify(out.totals));
console.log("the proof customer:", JSON.stringify(out.found));
await b.close();
