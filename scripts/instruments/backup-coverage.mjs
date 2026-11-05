#!/usr/bin/env node
/**
 * backup-coverage.mjs — what the store's copy holds, measured from the record itself.
 *
 * The question «فاضل كام جدول من الطقم» cannot be answered from the code that lists the targets; it
 * needs the live record, because a table can exist in the migrations and hold rows nobody copied.
 * This instrument asks the record for its tables and their row counts, runs the scope rules over
 * them, and writes the verdict with its date. The backup door reads that file — so the screen and
 * the measurement have one source, and a missing measurement says so instead of printing a zero.
 *
 * Reads only. Writes docs/ledger/backup-coverage.json. Exits 1 if the record does not answer.
 */
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";

import { SNAPSHOT_EXCLUSIONS, SNAPSHOT_TARGETS, coverageVerdict, formatCoverageLine } from "../../lib/ops/snapshot-scope.ts";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

if (!env.DIRECT_URL) {
  console.error("ما اتقارش: اتصال المخزن المباشر — النسخة ما تتقسش");
  process.exitCode = 1;
} else {
  const sql = postgres(env.DIRECT_URL, { max: 1 });
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name`;

  const recordTables = [];
  for (const t of tables) {
    const cols = await sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = ${t.table_name}`;
    const n = await sql.unsafe(`select count(*)::int as n from public."${t.table_name}"`);
    recordTables.push({ table: t.table_name, rows: n[0].n, columns: cols.map((c) => c.column_name) });
  }
  await sql.end();

  const verdict = coverageVerdict(recordTables);
  const out = {
    measuredAt: new Date().toISOString(),
    tablesInRecord: recordTables.length,
    targetsDeclared: SNAPSHOT_TARGETS.length,
    exclusionsDeclared: SNAPSHOT_EXCLUSIONS.length,
    copied: verdict.copied.map((c) => c.table),
    excluded: verdict.excludedNames,
    credentialTables: verdict.credentialTables,
    emptyUncovered: verdict.emptyUncovered,
    unexplained: verdict.unexplained,
    rowsCopied: verdict.rowsCopied,
    rowsUnexplained: verdict.rowsUnexplained,
    line: formatCoverageLine(verdict),
  };
  writeFileSync("docs/ledger/backup-coverage.json", JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`backup coverage: ${recordTables.length} tables in the record · ${out.copied.length} copied · ${out.unexplained.length} unexplained`);
  console.log(out.line);
  console.log("unexplained:", out.unexplained.slice(0, 20).join(", ") || "(none)");
}
