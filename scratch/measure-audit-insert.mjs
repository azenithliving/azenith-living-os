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
  log("== audit_log: defaults, nullability, row security ==");
  const cols = await sql`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='audit_log' order by ordinal_position`;
  for (const c of cols) log("  " + c.column_name + " :: " + c.data_type + " null=" + c.is_nullable + " default=" + (c.column_default ?? "NONE"));

  const rel = await sql`select c.relrowsecurity as rls, c.relforcerowsecurity as forced from pg_class c where c.oid = 'public.audit_log'::regclass`;
  log("  rls=" + rel[0]?.rls + " forced=" + rel[0]?.forced);

  const pol = await sql`select polname, polcmd::text as cmd, pg_get_expr(polqual, polrelid) as using_expr from pg_policy where polrelid='public.audit_log'::regclass`;
  log("  policies=" + pol.length);
  for (const p of pol) log("    " + p.polname + " cmd=" + p.cmd + " using=" + (p.using_expr ?? "-"));

  const trg = await sql`select tgname from pg_trigger t where t.tgrelid='public.audit_log'::regclass and not t.tgisinternal`;
  log("  triggers=" + trg.length);
  for (const t of trg) log("    " + t.tgname);

  const n = await sql`select count(*)::int as n from public.audit_log`;
  log("  rows=" + n[0]?.n);

  log("== who else writes an audit trail, and did their rows land? ==");
  for (const t of ["audit_logs", "sovereign_audit_logs", "immutable_command_log", "security_alerts"]) {
    const reg = await sql`select to_regclass('public.' || ${t}) as r`;
    if (!reg[0]?.r) {
      log("  " + t + " -> NOT A TABLE");
      continue;
    }
    const c = await sql.unsafe(`select count(*)::int as n from public.${t}`);
    log("  " + t + " rows=" + c[0]?.n);
  }
} catch (e) {
  log("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  await sql.end();
  fs.writeFileSync("scratch/measure-audit-insert.out", out.join("\n") + "\n");
}
