#!/usr/bin/env node
/**
 * record-columns.mjs — what the record actually answers, table by table.
 *
 * `lib/dal/record-schema.json` holds ten tables measured for one verdict. The phase that says
 * «no name in the code without an answer from the store» needs all of them, and it needs the answer
 * read from the record, not from the migrations that were supposed to run. This writes the map the
 * phantom-name scan compares against.
 *
 * Reads only. Writes docs/ledger/record-columns.json. Exits 1 if the record does not answer.
 */
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

if (!env.DIRECT_URL) {
  console.error("ما اتقارش: اتصال المخزن المباشر — خريطة الأعمدة ما تتعملش");
  process.exitCode = 1;
} else {
  const sql = postgres(env.DIRECT_URL, { max: 1 });
  const rows = await sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position`;
  await sql.end();

  const tables = {};
  for (const row of rows) (tables[row.table_name] ??= []).push(row.column_name);

  const out = {
    measuredAt: new Date().toISOString(),
    measuredBy: "node scripts/instruments/record-columns.mjs",
    note: "الأعمدة كما ردّ بها المخزن الآن — مش كما كتبتها الـmigrations",
    tables,
  };
  writeFileSync("docs/ledger/record-columns.json", JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`record columns: ${Object.keys(tables).length} tables · ${rows.length} columns → docs/ledger/record-columns.json`);
}
