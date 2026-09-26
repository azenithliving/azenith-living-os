/**
 * p7-scan-retired-tokens.mjs — where does a retired identifier actually live?
 *
 * P7 renames identifiers that are also *stored*: an agent key, a tool id, a table
 * name. The source tree says one thing, the rows another, and a rename in code
 * alone silently splits a metric series across two ids. This scans every text or
 * json column of every table the swarm writes and prints the distinct retired
 * tokens with their counts, so a rename is decided from the data, not from a grep.
 *
 * Read-only. Usage: node scripts/p7-scan-retired-tokens.mjs [token-regex]
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const p = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const pattern = process.argv[2] || "qayyim_[a-z0-9_]+|QAYYIM-[A-Z_]+|قيّم الدار";
// The pattern is interpolated into raw SQL, so anything that could end a string
// literal is refused rather than escaped.
if (/[';\\]/.test(pattern)) {
  console.error("pattern may not contain a quote, backslash or semicolon");
  process.exit(2);
}

const [{ tables }] = await p.$queryRawUnsafe(
  `select array_agg(table_name::text) as tables from information_schema.columns
    where table_schema = 'public'
      and data_type in ('text','character varying','json','jsonb')
    group by table_name`,
);

const found = [];
for (const table of tables) {
  const cols = await p.$queryRawUnsafe(
    `select column_name::text as column_name from information_schema.columns
      where table_schema = 'public' and table_name = $1
        and data_type in ('text','character varying','json','jsonb')`,
    table,
  );
  if (!cols.length) continue;
  const parts = cols.map(
    (c) =>
      `select '${table}' as t, '${c.column_name}' as col, (regexp_matches("${c.column_name}"::text, '(${pattern})', 'g'))[1] as tok
         from public."${table}" where "${c.column_name}"::text ~ '(${pattern})'`,
  );
  try {
    const rows = await p.$queryRawUnsafe(
      `select t, col, tok, count(*)::bigint as n from (${parts.join(" union all ")}) q group by t, col, tok order by n desc`,
    );
    found.push(...rows);
  } catch (e) {
    console.log(`SKIP ${table}: ${e.message.split("\n")[0]}`);
  }
}

const byToken = new Map();
for (const r of found) {
  const key = r.tok;
  if (!byToken.has(key)) byToken.set(key, []);
  byToken.get(key).push({ where: `${r.t}.${r.col}`, n: Number(r.n) });
}

if (!byToken.size) console.log("nothing matches — the retired token is gone from stored values");
for (const [token, hits] of [...byToken.entries()].sort((a, b) =>
  b[1].reduce((s, h) => s + h.n, 0) - a[1].reduce((s, h) => s + h.n, 0),
)) {
  const total = hits.reduce((s, h) => s + h.n, 0);
  console.log(`\n${token}  —  ${total} row(s)`);
  for (const h of hits.slice(0, 8)) console.log(`     ${h.n.toString().padStart(6)}  ${h.where}`);
  if (hits.length > 8) console.log(`     …and ${hits.length - 8} more column(s)`);
}

await p.$disconnect();
