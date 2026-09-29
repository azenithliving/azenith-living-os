/**
 * The defect class the delete door taught us: code that names a column the database
 * does not have, and then either throws or — worse — is ignored and reported as
 * success. This checks every `.from("table").select("columns")` in the tree against
 * the live schema, read-only.
 *
 * Usage: node scripts/ops-check-door-columns.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const norm = (f) => f.split(path.sep).join("/");
const walk = (d, acc = []) => {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    if (e.isDirectory()) walk(full, acc);
    else acc.push(norm(full));
  }
  return acc;
};
const sources = [...walk("app"), ...walk("lib"), ...walk("components")].filter((f) => /\.tsx?$/.test(f));

const relations = new Set((await db.$queryRawUnsafe(
  `select c.relname::text as n from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','v')`,
)).map((r) => r.n));

const columns = new Map();
for (const t of relations) {
  const cols = await db.$queryRawUnsafe(
    `select column_name::text as c from information_schema.columns where table_schema = 'public' and table_name = '${t.replace(/'/g, "''")}'`,
  );
  columns.set(t, new Set(cols.map((c) => c.c)));
}

const CALL = /\.from\(\s*["'`]([a-zA-Z0-9_]+)["'`]\s*\)([\s\S]{0,160}?)\.select\(\s*["'`]([^"'`]+)["'`]/g;
let checked = 0;
const problems = [];

for (const f of sources) {
  const text = fs.readFileSync(f, "utf8");
  for (const m of text.matchAll(CALL)) {
    const [, table, middle, select] = m;
    if (/\bcount\b|\*/.test(select)) continue;
    if (!relations.has(table)) { problems.push(`${f}: table "${table}" does not exist in the database`); continue; }
    if (/\binsert|update|delete\b/.test(middle)) continue;
    const have = columns.get(table) ?? new Set();
    // A token followed by "(" is an embedded relationship (users(...)), not a column,
    // and a token that is itself a table name is a foreign-key pull PostgREST resolves
    // through relationships. Counting either as a missing column is a false alarm.
    // PostgREST pulls related rows with `table ( cols )` inside a select. Those inner
    // columns belong to the related table, not this one — the first pass counted
    // `requests.session_id` from inside a `users ( ... )` embed and cried wolf.
    const own = select.replace(/\w+\s*\([^)]*\)/gs, " ");
    for (const raw of own.split(",")) {
      const tok = raw.trim();
      if (!tok || tok === "*") continue;
      if (/[()]/.test(tok)) continue;
      const col = tok.split("(")[0].split(".")[0].trim();
      if (!col) continue;
      if (relations.has(col)) continue;
      checked++;
      if (!have.has(col)) problems.push(`${f}: "${table}" has no column "${col}"`);
    }
  }
}

console.log(`source files scanned: ${sources.length}`);
console.log(`column names checked against the live schema: ${checked}`);
console.log(`missing: ${problems.length}`);
for (const p of [...new Set(problems)].slice(0, 40)) console.log(`   ${p}`);
await db.$disconnect();
