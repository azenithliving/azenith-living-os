import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import speakeasy from "speakeasy";

/**
 * Does the sales screen's leads door fail on the published store, and what does it say?
 *   node scratch/check-leads-door-live.mjs [base]
 *
 * The panel refetches every three seconds, so a broken door is a broken screen the owner may never
 * see explained. This logs in, watches the network and the console, and prints the door's own
 * sentence — the one the browser only ever puts in the log.
 */
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "https://azenith-living.vercel.app";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
const calls = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 120)));
p.on("requestfailed", (r) => calls.push({ url: r.url(), what: "فشل النقل: " + (r.failure()?.errorText || "?") }));
p.on("response", (r) => {
  if (r.url().includes("/api/admin/leads")) calls.push({ url: r.status() >= 400 ? r.url() : "", status: r.status() });
});

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);
console.log(`دخول: ${p.url().includes("/admin") ? "اتفتح" : "مفتوحش"}`);

await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(12000);

// Call the door directly too, so its sentence is read and not only its status code.
const door = await p.evaluate(async () => {
  const r = await fetch("/api/admin/leads", { cache: "no-store" });
  const j = await r.json().catch(() => null);
  const list = Array.isArray(j?.leads) ? j.leads : null;
  return { status: r.status, error: j?.error ?? null, leads: list ? list.length : null, keys: j ? Object.keys(j).slice(0, 6) : [] };
});
console.log(`\n=== باب القائمة: حالة ${door.status}${door.error ? ` · رسالة الباب: ${door.error}` : ""}`);
console.log(`   سطور العملاء: ${door.leads ?? "؟"} · مفاتيح الرد: ${door.keys.join(", ")}`);

const bad = calls.filter((c) => c.url);
// Grouped by address: an aborted request is only a defect if it is the panel's own door being
// cancelled — the first run printed a count without the address and proved nothing either way.
const byUrl = new Map();
for (const c of bad) {
  const key = c.url.replace(BASE, "").split("?")[0];
  byUrl.set(key, (byUrl.get(key) ?? 0) + 1);
}
console.log(`\n   نداءات موقوفة بالعدّ: ${bad.length ? [...byUrl.entries()].map(([u, n]) => `${u} = ${n}`).join(" | ") : "صفر"}`);
console.log(`   أخطاء الكونسول: ${errors.length ? [...new Set(errors)].slice(0, 4).join(" | ") : "صفر"}`);
await p.screenshot({ path: "scratch/leads-door-live.png" });
await b.close();
