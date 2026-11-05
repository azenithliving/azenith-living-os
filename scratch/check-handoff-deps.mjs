import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const res = await db.$queryRawUnsafe(
  `select table_name from information_schema.tables
     where table_schema='public' and table_name like 'agent%' order by table_name`);
console.log("agent* tables present:", res.map((r) => r.table_name).join(", "));
for (const n of ["agent_conversations", "agent_events"]) {
  const p = res.some((r) => r.table_name === n);
  console.log(n, p ? "EXISTS" : "MISSING");
}
await db.$disconnect();
