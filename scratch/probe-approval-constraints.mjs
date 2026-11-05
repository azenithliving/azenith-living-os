import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

const cons = await sql`
  select conname, contype, pg_get_constraintdef(oid) as def
  from pg_constraint where conrelid = 'public.approval_requests'::regclass order by contype, conname`;
for (const c of cons) console.log(c.contype + " " + c.conname + " => " + c.def);

const notNull = await sql`
  select column_name from information_schema.columns
  where table_schema='public' and table_name='approval_requests' and is_nullable='NO' and column_default is null`;
console.log("أعمدة إجبارية بلا افتراضي: " + notNull.map((c) => c.column_name).join(", "));

const rows = await sql`select count(*)::int as c from approval_requests`;
console.log("أسطر الطلبات الموجودة: " + rows[0].c);
const rl = await sql`select risk_level, count(*)::int c from approval_requests group by 1`;
console.log("مستويات الخطورة المسجلة: " + rl.map((r) => r.risk_level + "=" + r.c).join(", "));

await sql.end();
