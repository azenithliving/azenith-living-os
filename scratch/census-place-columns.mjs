import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Does any real customer record already pair a place with a taste? — read-only.
 *   node scratch/census-place-columns.mjs
 *
 * The region station's ranking is only honest if an area exists somewhere with a preference next
 * to it. Before inventing a column, this prints every column of the customer tables and marks the
 * ones whose value looks like an Egyptian area name.
 */
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const PLACE = /القاهرة|الجيزة|اسكندرية|الإسكندرية|تجمع|زايد|أكتوبر|October|Rehab|Madinaty|مدينة|منطقة|محافظ|New Cairo| المعادي|زمالك|حلوان|الشيخ/;

function mask(s) {
  return s.replace(/\d/g, "٠").slice(0, 60);
}

function classify(row) {
  const out = [];
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue;
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (PLACE.test(s)) out.push(`${k} ← ${mask(s.replace(/\s+/g, " "))}`);
  }
  return out;
}

for (const table of ["requests", "leads", "sales_orders", "bookings", "users", "lead_conversions", "consultant_sessions"]) {
  const { data, error } = await sb.from(table).select("*").limit(200);
  if (error) {
    console.log(`\n=== ${table}: خطأ ${error.message}`);
    continue;
  }
  const cols = data && data.length ? Object.keys(data[0]) : [];
  console.log(`\n=== ${table} · صفوف مقروءة ${(data ?? []).length} · الأعمدة: ${cols.join(", ")}`);
  const hits = [];
  for (const row of data ?? []) {
    const found = classify(row);
    if (found.length) hits.push(...found);
  }
  console.log(`   اللي فيه اسم مكان: ${hits.length ? "" : "ولا سطر"}`);
  for (const h of [...new Set(hits)].slice(0, 12)) console.log("   •", h);
}
