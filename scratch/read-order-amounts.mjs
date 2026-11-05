/**
 * How much is actually sitting in the order ledger? Amounts are not secrets and the answer
 * decides whether a zero on a card means "nothing was paid" or "the number is missing".
 *
 * Read-only.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const rows = await db.$queryRawUnsafe(
  `select id, status, total_amount, deposit_amount, deposit_paid, user_id is not null as owned
     from public.sales_orders order by created_at`);
for (const r of rows) {
  console.log(`order …${String(r.id).slice(-6)}  status=${r.status ?? "-"}  total=${r.total_amount}  deposit=${r.deposit_amount}  paid=${r.deposit_paid}  owned=${r.owned}`);
}
const sum = rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
console.log("orders:", rows.length, "| total of totals:", sum);

await db.$disconnect();
