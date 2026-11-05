import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 500; const rows = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb.from("agent_messages").select("content,context").eq("sender_type","agent")
    .order("created_at",{ascending:false}).range(from, from+PAGE-1);
  if (error) throw new Error(error.message);
  rows.push(...data); if (data.length < PAGE) break;
}
const noDesk = rows.filter(r => !(Array.isArray(r.context?.desks) ? r.context.desks.length : r.context?.tool));
const SHAPES = ["تحت السيطرة","على ما يرام","أفضل ما يكون","في أوج","ممتازة","رائعة","مستقرة","الوضع آمن","بدون أي مشاكل","خالية من العيوب","كل شيء جاهز","جاهز بالكامل"];
for (const s of SHAPES) {
  const all = rows.filter(r => String(r.content||"").includes(s)).length;
  const nd = noDesk.filter(r => String(r.content||"").includes(s)).length;
  if (all) console.log(`«${s}» — ${all} سطر · ${nd} منهم من غير أي مكتب`);
}
console.log(`سطور بلا مكتب: ${noDesk.length} من ${rows.length}`);
