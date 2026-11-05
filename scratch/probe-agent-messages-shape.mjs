import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const cols = await db.$queryRawUnsafe(
  "select column_name, data_type, is_nullable from information_schema.columns where table_name='agent_messages' order by ordinal_position"
);
console.log("agent_messages:", cols.map((c) => `${c.column_name}:${c.data_type}`).join(" | "));
const withMeta = await db.$queryRawUnsafe(
  "select count(*)::int n from public.agent_messages where metadata is not null"
);
const total = await db.$queryRawUnsafe("select count(*)::int n from public.agent_messages");
console.log("rows carrying metadata:", JSON.stringify(withMeta), "of", JSON.stringify(total));
await db.$disconnect();
