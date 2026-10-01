/**
 * Applies 20261001_room_sketches.sql over the direct Postgres connection, statement by
 * statement, and then proves the table answers — a migration that was not read back is
 * a migration that may not have happened.
 */
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing the direct database connection");
  process.exit(1);
}

const raw = readFileSync(join(__dirname, "..", "supabase", "migrations", "20261001_room_sketches.sql"), "utf8");
const statements = raw
  .split("--SPLIT--")
  .map((chunk) => chunk.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

const sqlClient = postgres(connectionString, { ssl: "require", max: 1 });

try {
  for (const [i, statement] of statements.entries()) {
    await sqlClient.unsafe(statement);
    console.log(`statement ${i + 1}/${statements.length} applied`);
  }

  const shape = await sqlClient`
    select column_name, data_type
      from information_schema.columns
     where table_schema = 'public' and table_name = 'room_sketches'
     order by ordinal_position`;
  console.log(`room_sketches columns = ${shape.length}`);
  console.log(`  ${shape.map((c) => c.column_name).join(", ")}`);

  const rls = await sqlClient`
    select relrowsecurity from pg_class where oid = 'public.room_sketches'::regclass`;
  console.log(`row level security on = ${rls[0]?.relrowsecurity}`);

  const count = await sqlClient`select count(*)::int as n from public.room_sketches`;
  console.log(`rows today = ${count[0]?.n}`);

  // The API gateway answers from a cached schema: a column renamed a minute ago is
  // still invisible to it, and the insert fails with "could not find the column".
  // Asking it to reload is part of applying a migration, not an optional extra.
  await sqlClient`select pg_notify('pgrst', 'reload schema')`;
  console.log("asked the API gateway to reload its schema cache");
} catch (error) {
  console.error("Migration failed:", error?.message ?? error);
  process.exit(1);
} finally {
  await sqlClient.end();
}
