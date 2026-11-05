import { readFileSync } from "node:fs";
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();

/**
 * Applies one migration file over the direct connection, then asks PostgREST to reload its schema so
 * the new table is reachable without a restart. Reads back what actually landed.
 */
const file = process.argv[2] ?? "supabase/migrations/20261019_c_agent_executions.sql";
const sqlText = readFileSync(file, "utf8");

const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

const existedBefore = (await sql`select count(*)::int as c from pg_tables where schemaname='public' and tablename='agent_executions'`)[0].c;
console.log("الجدول كان موجودًا قبل التطبيق: " + existedBefore);

await sql.unsafe(sqlText);
await sql`select pg_notify('pgrst', 'reload schema')`;

const cols = await sql`
  select column_name from information_schema.columns
  where table_schema='public' and table_name='agent_executions' order by ordinal_position`;
const flags = await sql`
  select relrowsecurity from pg_class where oid = 'public.agent_executions'::regclass`;
const idx = await sql`select count(*)::int as c from pg_indexes where schemaname='public' and tablename='agent_executions'`;
const trig = await sql`select count(*)::int as c from pg_trigger where tgrelid='public.agent_executions'::regclass and not tgisinternal`;
const roles = await sql`
  select grantee, privilege_type from information_schema.role_table_grants
  where table_name='agent_executions' order by 1,2`;

console.log("أعمدة: " + cols.length + " · منها execution_id=" + cols.some((c) => c.column_name === "execution_id"));
console.log("RLS مفعل: " + flags[0]?.relrowsecurity + " · فهارس: " + idx[0].c + " · زناد: " + trig[0].c);
console.log("صلاحيات مسندة لجهات خارجية: " + (roles.length ? roles.map((r) => r.grantee + "=" + r.privilege_type).join(",") : "لا شيء"));
const policies = await sql`select policyname from pg_policies where tablename='agent_executions'`;
console.log("سياسات الوصول: " + policies.length);

await sql.end();
