/**
 * Before promising a backfill: how many of the orders that carry a name match exactly one
 * customer profile? One match is a link; two matches is a guess. Prints counts only.
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

const counted = await db.$queryRawUnsafe(`
  select o.id,
         o.customer_name is not null and trim(coalesce(o.customer_name,'')) <> '' as named,
         (select count(*) from public.users u
           where trim(coalesce(u.full_name,'')) = trim(coalesce(o.customer_name,''))) as profile_matches
    from public.sales_orders o`);

const named = counted.filter((r) => r.named);
console.log("orders:", counted.length, "| carrying a name:", named.length);
console.log("exactly one profile with that name:", named.filter((r) => Number(r.profile_matches) === 1).length);
console.log("two or more profiles (a guess, not a link):", named.filter((r) => Number(r.profile_matches) > 1).length);
console.log("no profile at all:", named.filter((r) => Number(r.profile_matches) === 0).length);
console.log("orders with no name:", counted.length - named.length);

await db.$disconnect();
