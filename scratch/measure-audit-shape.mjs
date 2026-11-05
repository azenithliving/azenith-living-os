import fs from "node:fs";
import dotenv from "dotenv";
import postgres from "postgres";

for (const f of [".env.local", ".env"]) {
  const p = process.cwd() + "/" + f;
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

const out = [];
const log = (s) => {
  out.push(s);
  console.log(s);
};
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

try {
  for (const table of ["audit_log", "automation_rules", "approval_requests", "agent_memory"]) {
    const exists = await sql`select to_regclass('public.' || ${table}) as r`;
    log("TABLE " + table + " regclass=" + String(exists[0]?.r ?? "none"));
    const cols = await sql`select column_name, data_type, is_nullable from information_schema.columns where table_schema='public' and table_name=${table} order by ordinal_position`;
    log("  COLUMNS=" + cols.length);
    for (const c of cols) log("    " + c.column_name + " :: " + c.data_type + " null=" + c.is_nullable);
    const n = await sql.unsafe(`select count(*)::int as n from public.${table}`);
    log("  ROWS=" + n[0]?.n);
  }

  log("== is there another audit table that does have those columns? ==");
  const cands = await sql`select table_name from information_schema.tables where table_schema='public' and table_name like '%audit%' order by table_name`;
  for (const c of cands) log("  candidate: " + c.table_name);

  log("== which tables anywhere carry company_id / actor_user_id? ==");
  const withCol = await sql`select table_name, column_name from information_schema.columns where table_schema='public' and column_name in ('actor_user_id','approval_request_id','command_log_id','is_active') order by column_name, table_name`;
  for (const c of withCol) log("  " + c.column_name + " -> " + c.table_name);
} catch (e) {
  log("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  await sql.end();
  fs.writeFileSync("scratch/measure-audit-shape.out", out.join("\n") + "\n");
}
