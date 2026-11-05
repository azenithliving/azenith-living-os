import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Carries out the owner's word «امحيه» on one knowledge row, without losing the only thing in it
 * that nothing else records: the store's address.
 *   node scratch/delete-stale-hours-row.mjs         — read-only dry run, says what would happen
 *   node scratch/delete-stale-hours-row.mjs apply   — insert the address row, delete the old one,
 *                                                     then read both back from the store itself
 *
 * The delete is aimed at a primary key that is re-read and verified to still hold the stale hours
 * sentence immediately before it is removed — a pattern delete could take the wrong row if the
 * owner had edited anything since this was written.
 */
const APPLY = process.argv[2] === "apply";
const STALE_ID = "8e477c3c-c6ba-4e27-a323-684b0312f964";
const STALE_MUST_CONTAIN = "١٠ صباحا حتى ٦ مساء";
const ADDRESS_ROW = "عنوان الدار: مدينة السلام - القاهرة. (الشغل بالطلب والتفصيل، ملناش معرض تستناه)";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: stale } = await sb.from("consultant_learnings").select("id, instruction, created_at").eq("id", STALE_ID).maybeSingle();
if (!stale) {
  console.log("الصف المرشّح مش موجود — ولا حاجة اتعملت.");
  process.exit(0);
}
const text = String(stale.instruction ?? "").replace(/\s+/g, " ").trim();
console.log("الصف المرشّح للمحو:", stale.created_at);
console.log("  " + text);
if (!text.includes(STALE_MUST_CONTAIN)) {
  console.log(`الصف ما بقاش يحمل «${STALE_MUST_CONTAIN}» — وقفت، ما محيتش.`);
  process.exit(1);
}

if (!APPLY) {
  console.log("\nوضع القراءة: مش اتكتبش حاجة. شغّل بكلمة apply.");
  console.log("هيحصل: يضاف سطر العنوان لوحده → يتمحى الصف ده بالمفتاح → يتقرا الاتنين من المخزن.");
  process.exit(0);
}

const { data: added, error: addError } = await sb
  .from("consultant_learnings")
  .insert({ instruction: ADDRESS_ROW })
  .select("id, instruction, created_at")
  .single();
if (addError || !added) {
  console.log("السطر الجديد اتكتبش — فالقديم ما اتمحاوش:", addError?.message ?? "رد فاضي");
  process.exit(1);
}
console.log("\nسطر العنوان اتكتب:", added.id);

const { error: delError, count } = await sb.from("consultant_learnings").delete({ count: "exactCount" }).eq("id", STALE_ID).eq("instruction", stale.instruction);
console.log("الرد على المحو:", delError ? delError.message : `ولا خطأ · عدد الصفوف الممحاة = ${count}`);

const { data: after } = await sb
  .from("consultant_learnings")
  .select("id, instruction, created_at")
  .or("instruction.ilike.%مواعيد%,instruction.ilike.%عنوان الدار%")
  .order("created_at", { ascending: false });
console.log("\nقراية راجعة من المخزن — عدد الأسطر:", (after ?? []).length);
for (const row of after ?? []) console.log(`  #${String(row.id).slice(0, 8)} · ${String(row.instruction).replace(/\s+/g, " ").slice(0, 95)}`);

const gone = !(after ?? []).some((r) => r.id === STALE_ID);
console.log("\nالصف القديم راح؟", gone ? "أيوه" : "لأ — لسه موجود");
