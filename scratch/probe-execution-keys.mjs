import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

const tables = await sql`
  select tablename from pg_tables where schemaname='public'
  and (tablename like '%approval%' or tablename = 'agent_executions' or tablename = 'users' or tablename = 'companies')
  order by 1`;
console.log("جداول موجودة: " + tables.map((t) => t.tablename).join(", "));

const fks = await sql`
  select conname, pg_get_constraintdef(oid) as def from pg_constraints_probe`.catch(async () => {
  return await sql`
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint where conrelid = 'public.agent_executions'::regclass and contype = 'f'`;
});
console.log("قيود السجل: " + fks.map((f) => f.conname + " => " + f.def).join(" | "));

const cols = await sql`
  select column_name, is_nullable, column_default from information_schema.columns
  where table_schema='public' and table_name='approval_requests' order by ordinal_position`;
console.log("أعمطة approval_requests: " + (cols.length ? cols.map((c) => c.column_name).join(",") : "مفيش"));

const sample = await sql`select actor_user_id, company_id from agent_executions limit 3`;
console.log("أسطر السجل لحد دلوقتي: " + sample.length);

await sql.end();
