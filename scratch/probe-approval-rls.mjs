import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

const t = await sql`
  select relname, relrowsecurity from pg_class where oid = 'public.approval_requests'::regclass`;
console.log("RLS مفعل على طلبات الموافقة: " + t[0].relrowsecurity);

const pols = await sql`select polname, polcmd, pg_get_expr(polqual, polrelid) as using_, pg_get_expr(polwithcheck, polrelid) as check_ from pg_policy where polrelid='public.approval_requests'::regclass`;
console.log("سياسات: " + pols.length);
for (const p of pols) console.log("  " + p.polname + " [" + p.polcmd + "] check=" + (p.check_ ?? "-"));

const grants = await sql`select grantee, privilege_type from information_schema.role_table_grants where table_name='approval_requests' order by 1,2`;
console.log("صلاحيات: " + grants.map((g) => g.grantee + "=" + g.privilege_type).join(","));

const latest = await sql`select requested_at, status from approval_requests order by requested_at desc limit 3`;
console.log("آخر طلبات مسجلة: " + latest.map((r) => String(r.requested_at) + "/" + r.status).join(" · "));

await sql.end();
