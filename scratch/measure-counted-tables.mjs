/**
 * measure-counted-tables.mjs — which tables the mastermind status loop counts, and which exist.
 *
 * The loop writes `count || 0`, so a table the record does not have and a table with no rows print
 * the same number on an admin surface. This names the difference.
 */
import fs from "node:fs";
import dotenv from "dotenv";
import postgres from "postgres";

for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) dotenv.config({ path: f });

const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const out = [];
const say = (s) => {
  out.push(s);
  console.log(s);
};

const tables = ["room_sections", "requests", "intelligence_snapshots", "semantic_cache", "api_keys_arsenal", "system_intelligence"];
say("tables the status loop counts: " + tables.length);

for (const t of tables) {
  const exists = await sql`select count(*)::int c from information_schema.tables where table_schema='public' and table_name=${t}`;
  if (!exists[0].c) {
    say(`ABSENT  ${t} → the record has no such table, the loop prints 0`);
    continue;
  }
  const exact = await sql`select relname, n_live_tup from pg_stat_user_tables where relname=${t}`;
  say(`PRESENT ${t} → live tuples estimate ${exact.length ? exact[0].n_live_tup : "-"}`);
}

fs.writeFileSync("scratch/measure-counted-tables.out", out.join("\n") + "\n");
await sql.end();
