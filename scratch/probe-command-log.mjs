import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const total = await db.$queryRawUnsafe(`select count(*)::int n, max(executed_at)::text last, count(*) filter (where executed_at > now() - interval '7 days')::int week from public.immutable_command_log`);
const byUser = await db.$queryRawUnsafe(`select coalesce(user_id::text,'(null)') u, count(*)::int n from public.immutable_command_log group by 1 order by 2 desc limit 5`);
console.log("rows:", JSON.stringify(total, (k, v) => (typeof v === "bigint" ? Number(v) : v)));
console.log("by user:", JSON.stringify(byUser, (k, v) => (typeof v === "bigint" ? Number(v) : v)).slice(0, 400));
await db.$disconnect();
