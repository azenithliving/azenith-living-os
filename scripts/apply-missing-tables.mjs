/**
 * Applies 030_missing_tables_fix.sql via direct Postgres connection.
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
  console.error("Missing DIRECT_URL or DATABASE_URL");
  process.exit(1);
}

const sql = readFileSync(
  join(__dirname, "..", "supabase", "migrations", "030_missing_tables_fix.sql"),
  "utf8"
);

const sqlClient = postgres(connectionString, { ssl: "require", max: 1 });

try {
  console.log("Applying 030_missing_tables_fix.sql...");
  await sqlClient.unsafe(sql);
  console.log("Migration applied successfully.");

  const tables = ["consultant_faq", "leads", "elite_briefs", "subscriptions"];
  for (const table of tables) {
    const rows = await sqlClient`SELECT to_regclass(${`public.${table}`}) AS reg`;
    console.log(`${table}: ${rows[0]?.reg ? "OK" : "MISSING"}`);
  }
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  await sqlClient.end();
}
