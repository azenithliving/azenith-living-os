import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config();
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const rels = new Set((await sql`select tablename from pg_tables where schemaname='public'`).map((r) => r.tablename));
for (const t of ["companies", "users", "site_sections", "general_suggestions", "agent_executions", "backup_snapshots"]) {
  if (!rels.has(t)) { console.log(t + " — الجدول مش موجود"); continue; }
  const r = await sql.unsafe(`select count(*)::int c, coalesce(sum(pg_column_size(x)),0)::bigint b from "${t}" x`);
  console.log(t + " rows=" + r[0].c + " bytes=" + r[0].b);
}
if (rels.has("backup_snapshots")) {
  const s = await sql`select storage_provider, count(*)::int c from backup_snapshots group by 1`;
  console.log("النسخ القديمة محفوظة فين: " + s.map((x) => x.storage_provider + "=" + x.c).join(" · "));
  const pub = await sql`select count(*)::int c from backup_snapshots where storage_url like 'https://%'`;
  console.log("سطور فيها عنوان عام يبدأ بشبكة: " + pub[0].c);
}
await sql.end();
