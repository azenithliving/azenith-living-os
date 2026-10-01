/**
 * Applies any SQL file in supabase/migrations over the direct connection, statement by
 * statement, then reloads the API gateway's schema cache and reads the shape back.
 *
 * A migration that was not read back is a migration that may not have happened, and a
 * column added without telling the gateway fails later as "could not find the column"
 * in a place nobody is looking.
 *
 * Usage: node scripts/apply-sql-file.mjs supabase/migrations/20261001_b_room_sketch_passport.sql
 */
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const relative = process.argv[2];
if (!relative) {
  console.error("usage: node scripts/apply-sql-file.mjs <path to .sql>");
  process.exit(2);
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing the direct database connection");
  process.exit(1);
}

const file = resolve(__dirname, "..", relative);
const raw = readFileSync(file, "utf8");
const statements = raw
  .split("--SPLIT--")
  .map((chunk) => chunk.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

const table = (raw.match(/public\.([a-z_]+)/) || [])[1];
const sqlClient = postgres(connectionString, { ssl: "require", max: 1 });

try {
  for (const [i, statement] of statements.entries()) {
    await sqlClient.unsafe(statement);
    console.log(`statement ${i + 1}/${statements.length} applied`);
  }

  if (table) {
    const shape = await sqlClient`
      select column_name from information_schema.columns
       where table_schema = 'public' and table_name = ${table}
       order by ordinal_position`;
    console.log(`${table} columns = ${shape.length}: ${shape.map((c) => c.column_name).join(", ")}`);
  }

  await sqlClient`select pg_notify('pgrst', 'reload schema')`;
  console.log("asked the API gateway to reload its schema cache");
} catch (error) {
  console.error("Migration failed:", error?.message ?? error);
  process.exit(1);
} finally {
  await sqlClient.end();
}
