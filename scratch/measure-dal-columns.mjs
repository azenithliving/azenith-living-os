/**
 * measure-dal-columns.mjs — every column the unified data layer filters on, checked against the record.
 *
 * The layer is one file, 636 lines, and it is what the doors reach for the record. A filter on a
 * column the record never had cannot return a row and cannot raise in code — it just reads as dead.
 * This walks the file, pulls (table, column) pairs out of the query builders, and asks the record.
 */
import fs from "node:fs";
import dotenv from "dotenv";
import postgres from "postgres";

for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) dotenv.config({ path: f });

const out = [];
const say = (s) => {
  out.push(s);
  console.log(s);
};

const FILE = process.argv[2] ?? "lib/dal/unified-supabase.ts";
const OUT = process.argv[3] ?? "scratch/measure-dal-columns.out";
const SNAP = process.argv[4] ?? "lib/dal/record-schema.json";
const source = fs.readFileSync(FILE, "utf8");
const lines = source.split(/\r?\n/);

const FILTERS = /\.(eq|neq|gt|gte|lt|lte|like|ilike|in|order|not|is|contains|containedBy|filter)\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g;
const FROM = /\.from\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g;

// Walk each chained call: remember the last .from(table) seen, then attribute filter columns to it.
const pairs = new Map();
let currentTable = null;
let currentLine = 0;
for (const raw of lines) {
  currentLine++;
  const from = FROM.exec(raw);
  if (from) {
    currentTable = from[1];
    FROM.lastIndex = 0;
  }
  FILTERS.lastIndex = 0;
  let m;
  while ((m = FILTERS.exec(raw))) {
    if (!currentTable) continue;
    const key = `${currentTable}.${m[2]}`;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(currentLine);
  }
  FILTERS.lastIndex = 0;
}

const tables = new Set([...pairs.keys()].map((k) => k.split(".")[0]));
say(`tables the layer filters: ${tables.size} · (table.column) pairs found: ${pairs.size}`);

const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const rows = await sql`
  select table_name, column_name from information_schema.columns
  where table_schema='public'`;
const real = new Map();
for (const r of rows) {
  if (!real.has(r.table_name)) real.set(r.table_name, new Set());
  real.get(r.table_name).add(r.column_name);
}
say(`columns read from the record for ${real.size} relations`);

// A write payload is the same defect class: a key the record has no column for is refused.
const WRITE = /\.(insert|update|upsert)\(\s*\{/g;
const KEY = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g;

const writes = [];
for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  WRITE.lastIndex = 0;
  const w = WRITE.exec(raw);
  if (!w) continue;
  // The table is the nearest .from('table') above the write, not the last one seen anywhere.
  let table = null;
  for (let back = i; back >= 0 && back > i - 20; back--) {
    const fm = /\.from\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/.exec(lines[back]);
    if (fm) {
      table = fm[1];
      break;
    }
  }
  if (!table) continue;
  // Collect the object keys until the brace closes (a small, deliberate window).
  const keys = [];
  for (let j = i; j < Math.min(i + 14, lines.length); j++) {
    KEY.lastIndex = 0;
    let km;
    while ((km = KEY.exec(lines[j]))) keys.push(km[1]);
    if (lines[j].includes("}")) break;
  }
  writes.push({ table, line: i + 1, keys });
}
say(`write payloads found: ${writes.length}`);

const bad = [];
for (const [key, where] of [...pairs.entries()].sort()) {
  const [table, column] = key.split(".");
  if (!real.has(table)) {
    bad.push(`NO TABLE  ${key} (lines ${where.join(",")})`);
    continue;
  }
  if (!real.get(table).has(column)) bad.push(`NO COLUMN ${key} (lines ${where.join(",")})`);
}
for (const w of writes) {
  if (!real.has(w.table)) {
    bad.push(`NO TABLE  ${w.table} (write at line ${w.line})`);
    continue;
  }
  const missing = w.keys.filter((k) => !real.get(w.table).has(k));
  if (missing.length) bad.push(`NO COLUMN in write payload ${w.table}: ${missing.join(",")} (line ${w.line})`);
}
say(`phantom filters found: ${bad.length}`);
bad.forEach((b) => say("  " + b));

const snapshot = {};
for (const t of [...tables].sort()) snapshot[t] = [...(real.get(t) ?? [])].sort();

// The same record also decides which tables can ever arrive live: only the ones its own
// realtime publication carries. Anything outside that list gets a channel that stays silent.
const published = await sql`
  select tablename from pg_publication_tables
  where pubname = 'supabase_realtime'
  order by tablename`;
const publishedTables = published.map((r) => r.tablename);
say(`tables the record publishes live: ${publishedTables.length} :: ${publishedTables.join(",")}`);
for (const t of ["agent_events", "ops_sync_events"]) {
  say(`  published? ${t}: ${publishedTables.includes(t)}`);
}

fs.writeFileSync(
  SNAP,
  JSON.stringify(
    {
      measuredAt: new Date().toISOString().slice(0, 10),
      measuredBy: "node scratch/measure-dal-columns.mjs",
      note: "Columns the record answers to, for every table the unified data layer filters or writes, plus the tables the record actually publishes live. The guards in tests/dal read this file; regenerate it after a migration, never by hand.",
      tables: snapshot,
      realtime: {
        publication: "supabase_realtime",
        measuredAt: new Date().toISOString().slice(0, 10),
        publishedTables,
      },
    },
    null,
    2
  ) + "\n"
);
say("snapshot tables written: " + Object.keys(snapshot).length);

fs.writeFileSync(OUT, out.join("\n") + "\n");
await sql.end();
