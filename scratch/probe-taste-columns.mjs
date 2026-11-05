/**
 * What spelling the taste columns actually carry — read-only, counts and samples only.
 * The dossier must print a room the owner can read, not a machine slug.
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });
const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

try {
  for (const col of ["room_type", "style", "service_type", "last_page", "intent", "budget"]) {
    const rows = await sql`select ${sql(col)}::text as v, count(*)::int as n
      from public.users where ${sql(col)} is not null and ${sql(col)}::text <> ''
      group by v order by n desc limit 12`;
    console.log(`\n== users.${col} ==`, rows.length ? "" : "(nothing stored)");
    for (const r of rows) console.log(`  ${String(r.v).slice(0, 60)}  ·  ${r.n}`);
  }
  const total = await sql`select count(*)::int as n from public.users`;
  console.log("\nusers rows:", total[0].n);
} catch (e) {
  console.error("probe failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
