import { config as loadEnv } from "dotenv";
import postgres from "postgres";
loadEnv({ path: ".env.local" });
const SITE = "https://azenith-living.vercel.app";
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

const mine = await sql`select count(*)::int c from companies`;
console.log("شركات في السجل:", mine[0].c);
const cols = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='companies' order by ordinal_position`;
console.log("أعمدة companies:", cols.map(c => c.column_name).join(" | "));

const res = await fetch(`${SITE}/api/tenants`);
const body = await res.json().catch(() => null);
console.log("الباب العام ردّ بالحالة:", res.status);
const rows = Array.isArray(body?.tenants) ? body.tenants : [];
console.log("عدد الشركات اللي رجعت:", rows.length);
console.log("الردّ فيه رقم واتساب؟", rows.some(r => typeof r?.whatsapp === "string" && r.whatsapp.length > 0));
console.log("الردّ فيه اسم شركة؟", rows.some(r => typeof r?.name === "string" && r.name.length > 0));

const DOMAIN = "qias-ameen-3abdi.example.test";
const post = await fetch(`${SITE}/api/tenants`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "قياس أمني — شركة مؤقتة", domain: DOMAIN, whatsapp: "000" }),
});
const postBody = await post.json().catch(() => null);
console.log("باب الإنشاء ردّ بالحالة:", post.status, "| مقتطف:", JSON.stringify(postBody ?? {}).slice(0, 120));
const planted = await sql`select id from companies where domain = ${DOMAIN}`;
console.log("الشركة المزروعة اتلاقت؟", planted.length > 0 ? "نعم — الباب كتب" : "لأ — الباب رفض");
if (planted.length) await sql`delete from companies where domain = ${DOMAIN}`;
const residue = await sql`select count(*)::int c from companies where domain = ${DOMAIN}`;
const after = await sql`select count(*)::int c from companies`;
console.log("ممسوح:", planted.length, "| فاضل:", residue[0].c, "| الإجمالي رجع:", after[0].c);
console.log("الباب رفض القراءة بالحالة:", res.status, "| والكتابة بالحالة:", post.status);
console.log("الحكم:", (rows.length > 0 || planted.length > 0 || res.status !== 401 || post.status !== 401) ? "الباب العام مكشوف: قراءة بلا دخول" + (planted.length ? " وكتابة بلا دخول" : "") : "الباب مقفول");
await sql.end();
