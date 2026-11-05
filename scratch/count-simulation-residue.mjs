/**
 * How much of what the dashboards count is simulation residue? The demo door stamps its
 * rows with a marker in the name and in the metadata — this counts them per ledger, so a
 * number quoted to the owner can be traced to a real buyer or admitted as a prop.
 *
 * Read-only. Counts only.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const leads = await db.$queryRawUnsafe(
  `select count(*)::int as total,
          count(*) filter (where name like '[SIM]%' or metadata ? 'simulated')::int as simulated
     from public.leads`);
const orders = await db.$queryRawUnsafe(
  `select count(*)::int as total,
          count(*) filter (where items::text like '%simulated%' or customer_name like '[SIM]%')::int as simulated,
          coalesce(sum(total_amount),0)::int as money_total,
          coalesce(sum(total_amount) filter (where items::text like '%simulated%' or customer_name like '[SIM]%'),0)::int as money_simulated
     from public.sales_orders`);
const jobs = await db.$queryRawUnsafe(`select count(*)::int as total from public.production_jobs`).catch(() => [{ total: -1 }]);
const inventory = await db.$queryRawUnsafe(`select count(*)::int as total from public.inventory_items`).catch(() => [{ total: -1 }]);

console.log("leads        :", JSON.stringify(leads[0]));
console.log("sales_orders :", JSON.stringify(orders[0]));
console.log("production_jobs:", JSON.stringify(jobs[0]), "| inventory_items:", JSON.stringify(inventory[0]));

await db.$disconnect();
