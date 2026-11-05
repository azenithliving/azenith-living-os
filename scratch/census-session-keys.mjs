import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
/**
 * Why the visitor rows and the conversations do not join. — read-only.
 *   node scratch/census-session-keys.mjs
 */
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const { data: users } = await sb.from("users").select("id,session_id,phone,full_name,created_at").order("created_at", { ascending: false }).limit(30);
const { data: sessions } = await sb.from("consultant_sessions").select("session_id,created_at").order("created_at", { ascending: false }).limit(30);
const set = new Set((sessions ?? []).map((s) => String(s.session_id)));
console.log("أسطر زوار (شكل المفتاح مطويّع، من غير بيانات شخصية):");
for (const u of users ?? []) {
  const sid = String(u.session_id ?? "");
  console.log(`  سطر ${u.id?.slice(0, 8)}… · مفتاح الجلسة ${sid.slice(0, 12)}… (طوله ${sid.length}) · موبايل=${u.phone ? "أيوه" : "لأ"} · اسم=${u.full_name ? "أيوه" : "لأ"} · في الجلسات الأخيرة؟ ${set.has(sid) ? "أيوه" : "لأ"}`);
}
console.log("\nجلسات (شكل المفتاح):");
for (const s of (sessions ?? []).slice(0, 8)) console.log(`  ${String(s.session_id).slice(0, 16)}… (طوله ${String(s.session_id).length})`);
const { data: all } = await sb.from("consultant_sessions").select("session_id").limit(1000);
const allSet = new Set((all ?? []).map((r) => String(r.session_id)));
const joined = (users ?? []).filter((u) => allSet.has(String(u.session_id))).length;
console.log(`\nأسطر الزوار اللي ليها جلسة في نفس السجل: ${joined} من ${(users ?? []).length}`);
