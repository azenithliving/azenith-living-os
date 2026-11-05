import { readFileSync } from "node:fs";
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();
const file = process.argv[2] ?? "supabase/migrations/20261019_d_execution_actor_identity.sql";
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

await sql.unsafe(readFileSync(file, "utf8"));
await sql.unsafe("select pg_notify('pgrst', 'reload schema')");

const fks = await sql`
  select conname, pg_get_constraintdef(oid) as def
  from pg_constraint where conrelid = 'public.agent_executions'::regclass and contype = 'f' order by 1`;
console.log("القيود الآن: " + fks.map((f) => f.conname + " => " + f.def).join(" | "));

await sql.end();
