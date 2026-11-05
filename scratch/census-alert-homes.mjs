/**
 * Read-only census: is there already a table that can hold the watcher's alerts, and what is in it?
 *
 * The watcher keeps its alerts in a Map inside the request, so on serverless it forgets them the
 * moment the answer is sent. Before adding a table we have to know whether one exists that already
 * owns this fact — adding a second home to a fact that has an owner is the defect class that keeps
 * coming back.
 *
 * Prints: candidate tables, their columns, row counts, and whether row level security is on.
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing the direct database connection");
  process.exit(1);
}

const rest = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function exactCount(name) {
  const { count, error } = await rest.from(name).select("*", { count: "exact", head: true });
  if (error) return `unreadable (${error.code})`;
  return count;
}

const sqlClient = postgres(connectionString, { ssl: "require", max: 1 });

try {
  const tables = await sqlClient`
    select table_name from information_schema.tables
     where table_schema = 'public'
       and table_name ~* '(alert|health|sentinel|telemetry|monitor|system)'
     order by table_name`;

  console.log(`candidate tables = ${tables.length}`);

  for (const { table_name: name } of tables) {
    const cols = await sqlClient`
      select column_name, data_type from information_schema.columns
       where table_schema = 'public' and table_name = ${name}
       order by ordinal_position`;
    const count = await exactCount(name);
    const rls = await sqlClient`
      select relrowsecurity from pg_class where relname = ${name} and relnamespace = 'public'::regnamespace`;
    const pols = await sqlClient`
      select polname from pg_policy p
        join pg_class c on c.oid = p.polrelid
       where c.relname = ${name}`;
    console.log(`\n## ${name}  rows=${count}  rls=${rls[0]?.relrowsecurity}  policies=${pols.map((p) => p.polname).join(",") || "none"}`);
    console.log(`   columns: ${cols.map((c) => `${c.column_name}:${c.data_type}`).join(", ")}`);
  }

  // Also: does anything in the shipping code already write to an alert-shaped table?
  const allTables = await sqlClient`
    select table_name from information_schema.tables where table_schema = 'public' order by table_name`;
  console.log(`\nall public tables = ${allTables.length}`);
  console.log(allTables.map((t) => t.table_name).join(", "));
} catch (error) {
  console.error("Census failed:", error?.message ?? error);
  process.exit(1);
} finally {
  await sqlClient.end();
}
