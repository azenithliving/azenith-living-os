/**
 * Evidence for the customer-domain merge table: for every ledger that speaks about
 * customers, how full is it, who writes it, who reads it, and when was it last
 * touched. The last column is what tells a live desk from a dead one — a table with
 * rows but no new row in a year is a museum, not a machine.
 *
 * Read-only. Prints names and counts; no credential and no customer value.
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
const sources = [...walk("app"), ...walk("lib"), ...walk("components"), ...walk("scripts")].filter((f) => /\.tsx?$/.test(f));
const texts = sources.map((f) => [f, fs.readFileSync(f, "utf8")]);

const TABLES = [
  "consultant_sessions", "consultant_faq", "consultant_learnings", "consultant_pending_questions",
  "requests", "users", "leads", "lead_conversions", "bookings", "sales_orders", "sales_order_items",
  "visitor_sessions", "elite_sessions", "sovereign_sessions", "client_access", "approval_requests",
  "vanguard_leads", "vanguard_lead_activities", "vanguard_opportunities",
];

const present = new Set((await db.$queryRawUnsafe(
  `select c.relname::text as n from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','v')`,
)).map((r) => r.n));

const dateCols = async (t) => (await db.$queryRawUnsafe(
  `select column_name::text as c from information_schema.columns where table_schema='public' and table_name=$1 and data_type in ('timestamp with time zone','timestamp without time zone','date')`,
  t,
)).map((r) => r.c);

for (const t of TABLES) {
  if (!present.has(t)) {
    const writers = texts.filter(([, s]) => s.includes(`"${t}"`) || s.includes(`'${t}'`)).map(([f]) => f);
    console.log(`${t}\n  EXISTS=no  files that write/read it=${writers.length}`);
    for (const w of writers.slice(0, 6)) console.log(`     ${w}`);
    continue;
  }
  const [{ n: rows }] = await db.$queryRawUnsafe(`select count(*)::int as n from "${t}"`);
  const cols = await dateCols(t);
  let newest = "";
  let newestCol = "";
  for (const c of cols.slice(0, 4)) {
    try {
      const r = await db.$queryRawUnsafe(`select max("${c}")::text as m from "${t}"`);
      if (r[0]?.m && r[0].m > newest) { newest = r[0].m; newestCol = c; }
    } catch { /* a column this query cannot read is not evidence */ }
  }
  const readers = texts.filter(([, s]) => s.includes(`"${t}"`) || s.includes(`'${t}'`)).length;
  const inAdmin = texts.filter(([f, s]) => f.startsWith("app/admin") && (s.includes(`"${t}"`) || s.includes(`'${t}'`))).length;
  const inDoors = texts.filter(([f, s]) => f.startsWith("app/api") && (s.includes(`"${t}"`) || s.includes(`'${t}'`))).length;
  console.log(`${t}\n  rows=${rows}  files=${readers}  admin screens=${inAdmin}  doors=${inDoors}  newest=${newest}`);
}
await db.$disconnect();
