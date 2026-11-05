import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 500; const rows = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb.from("agent_messages").select("content,context,created_at").eq("sender_type","agent")
    .order("created_at",{ascending:false}).range(from, from + PAGE - 1);
  if (error) throw new Error(error.message);
  rows.push(...data); if (data.length < PAGE) break;
}
const CLAIMS = [
  ["claims a tool or desk ran", /فعّلنا|تم تنفيذ|شغّلنا|بعد تفعيل الأدوات|نفّذت|قمت ب|قام الوكلاء|توزيع الأدوار/],
  ["claims a critic or review happened", /ناقد|راجعه|مراجع|صححه داخليًا|بعد المراجعة/],
  ["asserts the store is fine", /كل حاجة تمام|كل شيء تمام|لا توجد مشاكل|لا مشاكل|الوضع مستقر|كله تمام/],
];
const tally = CLAIMS.map(([name]) => ({ name, total: 0, withoutDesk: 0 }));
for (const r of rows) {
  const hasDesk = Boolean(r?.context?.tool);
  CLAIMS.forEach(([name, re], i) => {
    if (re.test(String(r.content || ""))) {
      tally[i].total += 1;
      if (!hasDesk) tally[i].withoutDesk += 1;
    }
  });
}
console.log(`agent rows ${rows.length}`);
for (const t of tally) console.log(`  ${t.name}: ${t.total} rows · ${t.withoutDesk} of them carry no desk record`);
