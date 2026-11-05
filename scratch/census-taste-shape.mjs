import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Shape of the taste signals that could be joined to an area — read-only.
 *   node scratch/census-taste-shape.mjs
 *
 * The region station can only rank by a real area taste if some row pairs a preference with the
 * customer's area. This prints the columns and one live value of each candidate, so the design is
 * built on what the tables hold, not on what the plan paper hoped they held.
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

function show(v) {
  const s = JSON.stringify(v);
  return (s ?? "null").replace(/\s+/g, " ").slice(0, 190);
}

for (const table of ["requests", "family_votes", "room_sketches"]) {
  const { data, error } = await sb.from(table).select("*").limit(3);
  console.log(`\n=== ${table} ${error ? "خطأ: " + error.message : ""}`);
  if (!error) for (const row of data ?? []) console.log("  ", show(row));
}

const { data: sketches } = await sb
  .from("room_sketches")
  .select("id,room,colour_picks,plan,confirmed_count,ok,customer_key,area_sqm,created_at")
  .order("id", { ascending: false })
  .limit(40);
let withColour = 0;
let withPlan = 0;
for (const r of sketches ?? []) {
  if (r.colour_picks && (Array.isArray(r.colour_picks) ? r.colour_picks.length : Object.keys(r.colour_picks).length)) withColour++;
  if (r.plan && (typeof r.plan === "object" ? Object.keys(r.plan).length : true)) withPlan++;
}
console.log(`\n=== الأوراق (${(sketches ?? []).length} مقروءة): فيها ألوان مختارة ${withColour} · فيها بلان ${withPlan}`);
for (const r of (sketches ?? []).slice(0, 6)) {
  console.log(`  ورقة ${r.id}: غرفة=${show(r.room)} ألوان=${show(r.colour_picks)} بلان=${show(r.plan)?.slice(0, 80)}`);
}

const { data: votes } = await sb.from("family_votes").select("sketch_id,image_key,liked").limit(20);
console.log("\n=== تصويتات العيلة (٢٠ آخر حاجة) — الرقم الشخصي مقصود بره، ده مش للطباعة");
for (const v of votes ?? []) console.log(`  ورقة ${v.sketch_id} · مفتاح الصورة ${show(v.image_key)} · عاجلة=${v.liked}`);
