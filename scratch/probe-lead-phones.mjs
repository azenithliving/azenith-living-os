import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const rows = await db.$queryRaw`select phone, count(*)::int n from public.leads where phone is not null group by phone order by n desc limit 12`;
console.log("distinct lead phones (top):", JSON.stringify(rows.map((r) => `${r.phone}×${r.n}`)));
const shapes = await db.$queryRaw`select regexp_replace(phone, '[^0-9]', '', 'g') as digits, count(*)::int n from public.leads where phone is not null group by digits order by n desc limit 8`;
console.log("digit forms:", JSON.stringify(shapes.map((r) => `${r.digits}×${r.n}`)));
const users = await db.$queryRaw`select phone from public.users where phone is not null and length(regexp_replace(phone,'[^0-9]','','g')) >= 10 limit 5`;
console.log("users with a phone:", JSON.stringify(users.map((u) => u.phone)));
await db.$disconnect();
