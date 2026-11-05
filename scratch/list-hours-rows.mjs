import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Lists the knowledge rows that speak of hours or an address, with their ids — read-only, so a
 * deletion can be aimed at one primary key instead of a pattern.
 *   node scratch/list-hours-rows.mjs
 */
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error } = await sb
  .from("consultant_learnings")
  .select("*")
  .or("instruction.ilike.%مواعيد%,instruction.ilike.%صباح%,instruction.ilike.%مفتوح%,instruction.ilike.%عنوان%,instruction.ilike.% السلام%")
  .order("created_at", { ascending: false })
  .limit(15);

if (error) {
  console.log("خطأ:", error.message);
  process.exit(1);
}
console.log("أعمدة الجدول:", data?.length ? Object.keys(data[0]).join(", ") : "ولا صف");
console.log("عدد الصفوف:", data?.length ?? 0);
for (const row of data ?? []) {
  console.log(`\n#${row.id} · ${row.created_at} · شركة=${row.company_id ?? "(بلا)"} · مفعّل=${row.is_active ?? "(بلا عمود)"}`);
  console.log("   " + String(row.instruction).replace(/\s+/g, " ").trim());
}
