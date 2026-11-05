import { readFileSync } from "node:fs";
import postgres from "postgres";

const source = readFileSync("lib/ops/nightly-snapshot.ts", "utf8");
const block = source.slice(source.indexOf("SNAPSHOT_TARGETS"), source.indexOf("SNAPSHOT_STAMP_KEY"));
const SNAPSHOT_TARGETS = [...block.matchAll(/\{\s*table:\s*"([^"]+)",\s*order:\s*"([^"]+)"/g)].map(
  ([, table, order]) => ({ table, order }),
);

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

const sql = postgres(env.DIRECT_URL, { max: 1 });

const tables = await sql`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name`;

const counts = {};
for (const t of tables) {
  const r = await sql.unsafe(`select count(*)::int as n from public."${t.table_name}"`);
  counts[t.table_name] = r[0].n;
}

const covered = new Set(SNAPSHOT_TARGETS.map((t) => t.table));
const business = Object.keys(counts).filter((n) =>
  /order|lead|product|sketch|draft|sheet|passport|cart|booking|payment|customer|room/i.test(n),
);

console.log("tables in the record:", tables.length);
console.log("snapshot targets:", covered.size);
console.log("targets missing from the record:", [...covered].filter((c) => !(c in counts)).join(", ") || "(none)");
console.log("business-shaped tables:");
for (const n of business) console.log(`  ${n} rows=${counts[n]} covered=${covered.has(n)}`);

const uncoveredRows = business.filter((n) => !covered.has(n)).reduce((a, n) => a + counts[n], 0);
console.log("uncovered business rows:", uncoveredRows);
await sql.end();
