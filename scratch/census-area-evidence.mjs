import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * What area evidence the store's own tables really hold — read-only.
 *   node scratch/census-area-evidence.mjs
 *
 * The region station ranks the gallery by the taste of the customer's area. That claim is only
 * real if some row carries both an area and a preference, so this counts the areas that exist
 * and the taste signals (room, colour, votes, style) that live next to them.
 */
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.log("مفيش مفتاح قراءة في البيئة — الاسم بس: SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function count(table, field) {
  const base = await sb.from(table).select(field, { count: "exact", head: true }).limit(1);
  const filled = await sb
    .from(table)
    .select(field, { count: "exact", head: true })
    .not(field, "is", null)
    .neq(field, "")
    .limit(1);
  return {
    total: base.count ?? -1,
    filled: filled.count ?? -1,
    err: base.error ? base.error.message : filled.error ? filled.error.message : null,
  };
}

const probes = [
  ["room_sketches", "customer_city"],
  ["room_sketches", "room"],
  ["room_sketches", "colour_picks"],
  ["room_sketches", "plan"],
  ["room_sketches", "confirmed_at"],
  ["leads", "city"],
  ["leads", "area"],
  ["requests", "city"],
  ["sales_orders", "city"],
  ["bookings", "city"],
  ["consultant_sessions", "customer_city"],
  ["elite_leads", "city"],
];

console.log("=== عدد الصفوف اللي فيها قيمة مكتوبة");
for (const [table, field] of probes) {
  const r = await count(table, field);
  console.log(`  ${table}.${field}: الكل ${r.total} · المكتوب ${r.filled}${r.err ? ` · خطأ: ${r.err}` : ""}`);
}

console.log("\n=== المناطق المكتوبة فعلاً في الأوراق");
const { data: cities } = await sb.from("room_sketches").select("customer_city").not("customer_city", "is", null);
const tally = new Map();
for (const row of cities ?? []) {
  const c = String(row.customer_city ?? "").trim();
  if (c) tally.set(c, (tally.get(c) ?? 0) + 1);
}
console.log(`  أسطر: ${(cities ?? []).length} · أسماء مختلفة: ${tally.size}`);
for (const [name, n] of [...tally].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`    • ${name} (${n})`);

console.log("\n=== أي أعمدة في الجداول دي بتخزن ستايل أو ذوق");
for (const table of ["room_sketches", "leads", "requests", "elite_leads", "consultant_sessions"]) {
  const { data, error } = await sb.from(table).select("*").limit(1);
  if (error) {
    console.log(`  ${table}: خطأ ${error.message}`);
    continue;
  }
  const keys = data && data.length ? Object.keys(data[0]) : [];
  const taste = keys.filter((k) => /style|taste|colour|color|prefer|mood|room|city|area|region|district/i.test(k));
  console.log(`  ${table} (${keys.length} عمود) — اللي بيشبه الذوق/المكان: ${taste.join(", ") || "ولا عمود"}`);
}

console.log("\n=== تصويتات العيلة: كل سطر فيه إيه");
const { data: voteCols } = await sb.from("family_votes").select("*").limit(1);
console.log("  الأعمدة:", voteCols && voteCols.length ? Object.keys(voteCols[0]).join(", ") : "مفيش صفوف أو الجدول مش موجود");
const votes = await sb.from("family_votes").select("*", { count: "exact", head: true }).limit(1);
console.log("  عدد الصفوف:", votes.count, votes.error ? `· خطأ: ${votes.error.message}` : "");
