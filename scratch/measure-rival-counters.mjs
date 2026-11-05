/**
 * The remaining rival counters, measured instead of guessed. The office and the chat
 * now answer with one number; this asks what the owner's landing screen answers with,
 * and what each door says, so the next atom has a real figure to fix.
 */
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "node:fs";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const BASE = "http://localhost:3111";
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 60000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 25 && !p.url().includes("/admin"); i++) await p.waitForTimeout(1500);

const doors = await p.evaluate(async () => {
  const get = async (u) => {
    try { return await (await fetch(u, { cache: "no-store" })).json(); } catch (e) { return { error: String(e) }; }
  };
  const analytics = await get("/api/analytics?period=30days");
  const customers = await get("/api/admin/customers");
  const leads = await get("/api/admin/leads");
  return {
    analyticsKeys: Object.keys(analytics || {}),
    analyticsMetrics: analytics?.metrics ?? null,
    rollCustomers: customers?.totals?.customers ?? null,
    rollAnonymous: customers?.totals?.anonymous ?? null,
    leadsDoorCount: Array.isArray(leads?.leads) ? leads.leads.length : null,
  };
});
console.log(JSON.stringify(doors, null, 1));

await p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(14000);
const card = await p.evaluate(() => {
  const hits = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    const t = (walk.currentNode.textContent || "").trim();
    if (/العملاء المحتملين|عميل نشط|لا توجد بيانات/.test(t)) hits.push(t.slice(0, 60));
  }
  return hits;
});
console.log("the landing card says:", JSON.stringify(card));
const near = await p.evaluate(() => {
  const h = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && /العملاء المحتملين/.test(e.textContent || ""));
  if (!h) return null;
  const box = h.closest("div");
  return box ? (box.parentElement?.innerText || "").replace(/\s+/g, " ").slice(0, 120) : null;
});
console.log("card block text:", JSON.stringify(near));
await p.screenshot({ path: "scratch/landing-customer-card.png" });
await b.close();
