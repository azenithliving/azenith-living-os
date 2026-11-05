import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import speakeasy from "speakeasy";

/**
 * The published taste tally, read through the owner's own gate.
 *   node scratch/check-taste-tally-door.mjs [base]
 *
 * The claim is the door's number: styles counted through the store's own reader (one taste in one
 * bar, a screen's name in none), plus how many rows it left out. The old panel fetches this door but
 * never renders the tally, so the honest proof here is the response itself, read on the live site.
 */
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "https://azenith-living.vercel.app";
const WAIT = process.argv.includes("--wait");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));

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
console.log(`دخول: ${p.url().includes("/admin") ? "اتفتح" : "مفتوحش"} · ${p.url().replace(BASE, "")}`);

async function readDoor() {
  return p.evaluate(async () => {
    const r = await fetch("/api/analytics?period=30days", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    return { status: r.status, metrics: j?.metrics ?? null };
  });
}

let out = await readDoor();
for (let i = 0; WAIT && i < 24 && !(out.metrics && typeof out.metrics.styleRowsSkipped === "number"); i++) {
  console.log(`محاوله ${i + 1}: ${out.metrics ? "العدد القديم لسه" : `الرد ${out.status}`} — مستني البناء`);
  await p.waitForTimeout(30000);
  out = await readDoor();
}

const m = out.metrics ?? {};
console.log(`\n=== باب الأرقام على الرابط المنشور (حالة ${out.status})`);
console.log(`   إجمالي العملاء في الفترة: ${m.totalLeads ?? "؟"}`);
console.log(`   سطور ما اتحسبتش في الطراز: ${m.styleRowsSkipped ?? "مش موجود — البناء القديم"}`);
for (const s of m.topStyles ?? []) console.log(`   ${s.style} = ${s.count}`);
if (!m.topStyles?.length) console.log("   مفيش طرازات محسوبة");
await p.screenshot({ path: "scratch/taste-tally-door.png" });
console.log(`\n   أخطاء الكونسول: ${errors.length ? errors.join(" | ") : "صفر"}`);
await b.close();
