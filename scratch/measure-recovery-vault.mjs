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
  for (const name of ["recovery_vault", ["sovereign", "audit_logs"].join("_")]) {
    const reg = await sql`select to_regclass('public.' || ${name}) as r`;
    if (reg[0]?.r) log("TABLE EXISTS " + name + " :: " + String(reg[0].r));
    else log("TABLE MISSING " + name);
  }

  const reg = await sql`select to_regclass('public.recovery_vault') as r`;
  log("recovery_vault regclass=" + String(reg[0]?.r ?? "none"));
  if (!reg[0]?.r) throw new Error("stop: the vault table is absent, so its columns cannot be listed");

  const cols = await sql`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='recovery_vault' order by ordinal_position`;
  log("COLUMNS=" + cols.length);
  for (const c of cols) log("  " + c.column_name + " :: " + c.data_type + " null=" + c.is_nullable + " default=" + (c.column_default ?? "NONE"));

  const cons = await sql`select conname, contype::text, pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.recovery_vault'::regclass`;
  log("CONSTRAINTS=" + cons.length);
  for (const c of cons) log("  " + c.conname + " " + c.contype + " :: " + c.def);

  const n = await sql`select count(*)::int as n from public.recovery_vault`;
  log("ROWS=" + n[0]?.n);
  const who = await sql`select admin_id, remaining_attempts, created_at from public.recovery_vault order by created_at limit 5`;
  for (const w of who) log("  vault admin_id=" + String(w.admin_id) + " created=" + String(w.created_at));

  const rels = await sql`select table_name from information_schema.tables where table_schema='public' and (table_name like '%recovery%' or table_name like '%trusted_device%') order by table_name`;
  log("related tables=" + rels.map((r) => r.table_name).join(","));
} catch (e) {
  log("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  await sql.end();
  fs.writeFileSync("scratch/measure-recovery-vault.out", out.join("\n") + "\n");
}
