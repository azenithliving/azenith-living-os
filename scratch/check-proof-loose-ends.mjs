import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import speakeasy from "speakeasy";

/**
 * Two loose ends from the live proof, settled separately:
 *   ١) three console errors appeared during the proof — but the instrument reloaded the page
 *      after every turn, and a reload cancels in-flight requests. Read the page ONCE with no
 *      reload and count what the console really says.
 *   ٢) the row written with `desks: []` — did the honesty guard label it, or did it slip through?
 *      Read the stored sentence, not a screenshot.
 *   node scratch/check-proof-loose-ends.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const IDS = [
  "366a3930-53cc-4afe-b367-45be845fc2f1",
  "3b980a16-ebe7-4ae4-a7b0-91fc7dc9e572",
  "ded6ee91-3f86-4681-95cc-d62dfa96f5fe",
];

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: rows, error } = await sb
  .from("agent_messages")
  .select("id,created_at,context,content")
  .in("id", IDS)
  .order("created_at");
if (error) throw new Error(error.message);
for (const r of rows) {
  const tail = String(r.content).replace(/\s+/g, " ").slice(-90);
  console.log(`${r.created_at} · desks=${JSON.stringify(r.context?.desks)} · آخر الجملة: «${tail}»`);
}

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().replace(/\s+/g, " ").slice(0, 80)));

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);

errors.length = 0;
await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(25000);
console.log(`\nفتح الشاشة مرة واحدة من غير إعادة تحميل — أخطاء الكنسول: ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log(`  ${e}`);
const badge = await p.evaluate(() => {
  const els = [...document.querySelectorAll("[data-desk-name]")];
  return { count: els.length, names: els.map((e) => e.textContent.trim()).slice(-4) };
});
console.log(`شارات أسماء المكاتب: ${badge.count} — آخر أربع: ${badge.names.join(" | ")}`);
await p.screenshot({ path: "scratch/row-provenance-clean.png" });
await b.close();
