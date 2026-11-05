import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Can the region proof run on papers that already exist? — read-only.
 *   node scratch/check-region-rows.mjs
 *
 * A new row stays in the owner's roll (deleting one needs his word), so this looks for instrument
 * papers that already carry the store's own phone key: the contact desk accepts an area from them
 * without writing a number at all.
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

const { data: rows, error } = await sb
  .from("room_sketches")
  .select("id,token,customer_key,customer_city,room,colour_picks")
  .order("id", { ascending: true })
  .limit(500);
if (error) {
  console.log("القراءة مرفوضة:", error.message);
  process.exit(1);
}

const usable = (rows ?? []).filter((r) => r.token && r.customer_key);
const withColours = usable.filter((r) => (r.colour_picks ?? []).length);
const blank = usable.filter((r) => !(r.colour_picks ?? []).length);
console.log(`ورقات عندها عنوان ومفتاح عميل: ${usable.length} · منها عليها ألوان ${withColours.length} · فاضية من الألوان ${blank.length}`);
console.log("\nاللي عليها ألوان (تصلح شاهد):");
for (const r of withColours) {
  console.log(`  ${r.id} · مفتاح ${String(r.customer_key).slice(0, 6)}… · منطقة ${r.customer_city ?? "فاضية"} · ألوان ${r.colour_picks.map((p) => p.hex).join(" ")}`);
}
console.log("\nالفاضية (تصلح شاشة قياس):");
for (const r of blank.slice(0, 12)) console.log(`  ${r.id} · مفتاح ${String(r.customer_key).slice(0, 6)}… · غرفة ${r.room ?? "ولا غرفة"} · منطقة ${r.customer_city ?? "فاضية"}`);
