import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
loadEnv({ path: ".env.local" });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

const cols = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='curated_images' order by ordinal_position`;
const names = cols.map((c) => c.column_name);
console.log("أعمدة curated_images:", names.join(" | ") || "(الجدول مش موجود)");

const has = (n) => names.includes(n);
const total = await sql`select count(*)::int c from curated_images`;
console.log("عدد الصور:", total[0].c);
if (has("is_active")) {
  const act = await sql`select is_active, count(*)::int c from curated_images group by is_active order by 2 desc`;
  console.log("الحالة (is_active):", act.map(r => `${String(r.is_active)}=${r.c}`).join(" · "));
}
for (const col of names.filter((n) => /quality|score|dead|flag|status/i.test(n))) {
  const r = await sql`select count(*)::int filled from curated_images where ${sql(col)} is not null`;
  console.log(`عمود ${col}: فيه قيمة في ${r[0].filled} سطر`);
}
if (has("room_type")) {
  const byRoom = await sql`select room_type, count(*)::int c from curated_images group by room_type order by c desc limit 6`;
  console.log("توزيع على الغرف:", byRoom.map(r => `${r.room_type}=${r.c}`).join(" · "));
}
const size = await sql`select pg_total_relation_size('curated_images')::bigint s`;
console.log("حجم الجدول على القرص:", String(size[0].s));

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const buckets = await sb.storage.listBuckets();
console.log("الدرجات الموجودة:", buckets.map((b) => b.name).join(" · ") || "(ولا واحدة)");
for (const name of ["images", "curated-images"]) {
  const r = await sb.storage.from(name).list("", { limit: 3 });
  console.log(`درج ${name}:`, r.error ? `مرفوض — ${r.error.message}` : `${(r.data ?? []).length} عنصر أولي`);
}
const logs = await sql`select count(*)::int c from refresh_logs`.catch(() => [{ c: "الجدول مش موجود" }]);
console.log("سطور سجل التحديث:", logs[0].c);
await sql.end();
