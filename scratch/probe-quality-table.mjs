import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const t = await db.$queryRaw`select table_name from information_schema.tables where table_schema='public' and table_name like 'quality%'`;
console.log("quality tables:", JSON.stringify(t));
if (t.length) {
  const n = await db.$queryRaw`select count(*)::int n from public.quality_checks`;
  console.log("rows:", String(n[0].n));
}
await db.$disconnect();
