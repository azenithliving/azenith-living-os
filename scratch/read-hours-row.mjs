import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * What the store's own record actually says about its hours — read-only, so the schedule in code can
 * be made to obey it.  Prints the row's letters, never a key.
 *   node scratch/read-hours-row.mjs
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

const sb = createClient(url, key, { auth: { persistSession: false } });const { data, error } = await sb
  .from("consultant_learnings")
  .select("instruction, created_at")
  .like("instruction", "مواعيد العمل%")
  .order("created_at", { ascending: false })
  .limit(5);

console.log("خطأ القراءة:", error ? error.message : "ولا خطأ");
console.log("عدد الأسطر:", (data ?? []).length);
for (const row of data ?? []) console.log("  • " + String(row.instruction).replace(/\s+/g, " ").trim());

const { data: anyHours, error: err2 } = await sb
  .from("consultant_learnings")
  .select("instruction")
  .or("instruction.ilike.%مواعيد%,instruction.ilike.%مفتوح%,instruction.ilike.%صباح%")
  .limit(8);
console.log("\nأي سطر تاني بيتكلم عن ميعاد:", err2 ? err2.message : "ولا خطأ");
for (const row of anyHours ?? []) console.log("  • " + String(row.instruction).replace(/\s+/g, " ").trim().slice(0, 140));
