/**
 * The consultant's unanswered questions, measured before any screen is built on them:
 * how full the ledger is, how old the rows are, whether the same question repeats, and
 * whether answering it anywhere already exists.
 *
 * Read-only. Prints counts, column names and question text only — no contact detail.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const columns = await db.$queryRawUnsafe(
  `select column_name, data_type, is_nullable from information_schema.columns
    where table_schema='public' and table_name='consultant_pending_questions' order by ordinal_position`);
console.log("columns:", columns.map((c) => `${c.column_name}:${c.data_type}`).join(" · "));

const rows = await db.$queryRawUnsafe(`select * from public.consultant_pending_questions`);
console.log("rows:", rows.length);
for (const c of columns) {
  const filled = rows.filter((r) => r[c.column_name] !== null && String(r[c.column_name]).trim() !== "").length;
  if (filled) console.log(`  filled ${c.column_name}: ${filled}/${rows.length}`);
}

const span = await db.$queryRawUnsafe(
  `select min(created_at) as first_row, max(created_at) as last_row,
          count(*) filter (where created_at > now() - interval '30 days')::int as last_30_days
     from public.consultant_pending_questions`);
console.log("first:", String(span[0].first_row ?? "-"), "| newest:", String(span[0].last_row ?? "-"), "| in the last 30 days:", span[0].last_30_days);

// Does the same question come again? A repeated question is the one worth answering first.
const textCol = columns.map((c) => c.column_name).find((n) => /question/i.test(n));
if (textCol) {
  const grouped = await db.$queryRawUnsafe(
    `select lower(trim(${textCol})) as q, count(*)::int as times
       from public.consultant_pending_questions group by 1 having count(*) > 1 order by 2 desc limit 5`);
  console.log("questions asked more than once:", grouped.length);
  for (const g of grouped) console.log(`  ×${g.times}: ${String(g.q).slice(0, 70)}`);
}

const faq = await db.$queryRawUnsafe(`select count(*)::int as n from public.consultant_faq`);
console.log("approved answers the consultant can already give (faq rows):", faq[0].n);

await db.$disconnect();
