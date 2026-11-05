import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const a = await db.$queryRawUnsafe(`select coalesce(intent,'(null)') as v, count(*)::int as n from public.users group by intent order by n desc`);
console.log("users.intent:", JSON.stringify(a));
const b = await db.$queryRawUnsafe(`select coalesce(status,'(null)') as v, count(*)::int as n from public.leads group by status order by n desc`);
console.log("leads.status:", JSON.stringify(b));
const c = await db.$queryRawUnsafe(`select count(*)::int as users from public.users`);
console.log("users rows:", c[0].users);
await db.$disconnect();
