/**
 * ops-platform-census.mjs — the layer no file listing can see.
 *
 * The owner's objection that built this: «things in the real site have no link».
 * Same for data — a table no source file names is still a table with rows in it,
 * and a fence that counts files cannot lose what it never looked at. This asks the
 * database itself, read-only, and prints counts and object names only. No
 * credential value is ever printed, and no statement writes.
 *
 * Usage: node scripts/ops-platform-census.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const p = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

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

const sources = [...walk("app"), ...walk("lib"), ...walk("components"), ...walk("scripts"), ...walk("prisma")]
  .filter((f) => /\.(tsx?|mjs|cjs|js|prisma)$/.test(f));
const blob = sources.map((f) => fs.readFileSync(f, "utf8")).join("\n");
const namedInCode = (t) => blob.includes(`"${t}"`) || blob.includes(`'${t}'`) || blob.includes(`\`${t}\``) || blob.includes(`.${t}`) || blob.includes(`${t}(`);

const relations = await p.$queryRawUnsafe(
  `select c.relname::text as name, c.relkind::text as kind,
          (c.relrowsecurity and c.relkind='r') as rls
     from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r','v','m','p')
    order by c.relname`
);
const orphans = relations.filter((r) => !namedInCode(r.name));

console.log(`source files scanned: ${sources.length}`);
console.log(`relations in the live database: ${relations.length}`);
console.log(`  tables: ${relations.filter((r) => r.kind === "r" || r.kind === "p").length}`);
console.log(`  views:  ${relations.filter((r) => r.kind === "v").length}`);
console.log(`  materialised: ${relations.filter((r) => r.kind === "m").length}`);
console.log(`relations no source file names (blind spots): ${orphans.length}`);

for (const r of orphans) {
  let rows = "?";
  if (r.kind === "r" || r.kind === "p" || r.kind === "v") {
    try {
      const [{ n }] = await p.$queryRawUnsafe(`select count(*)::int as n from "${r.name}"`);
      rows = n;
    } catch { rows = "unreadable"; }
  }
  console.log(`   ${r.name.padEnd(42)} kind=${r.kind} rows=${rows}`);
}

const policies = await p.$queryRawUnsafe(
  `select count(*)::int as n, count(distinct tablename)::int as tables
     from pg_policies where schemaname='public'`
);
console.log(`row-security policies: ${policies[0].n} over ${policies[0].tables} tables`);

const unguarded = await p.$queryRawUnsafe(
  `select c.relname::text as name from pg_class c
     where c.relnamespace='public'::regnamespace and c.relkind='r'
       and not c.relrowsecurity and not c.relispartition
     order by c.relname`
);
console.log(`plain tables with row security OFF: ${unguarded.length}`);
for (const t of unguarded.slice(0, 12)) console.log(`   ${t.name}`);

const migrations = walk("supabase/migrations").filter((f) => f.endsWith(".sql"));
console.log(`migration files in the repository: ${migrations.length}`);

await p.$disconnect();
