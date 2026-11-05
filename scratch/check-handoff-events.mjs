import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const a = await db.$queryRawUnsafe(`select count(*)::int as n from public.agent_events`);
console.log("agent_events rows:", a[0].n);
const b = await db.$queryRawUnsafe(`select event_type, count(*)::int as n from public.agent_events group by event_type order by n desc limit 12`);
console.table(b);
const c = await db.$queryRawUnsafe(`select count(*)::int as n from public.agent_messages`);
console.log("agent_messages rows:", c[0].n);
const d = await db.$queryRawUnsafe(`select count(*)::int as escalated from public.consultant_sessions where metadata::text ilike '%handoff%'`);
console.log("consultant sessions carrying an escalation marker:", d[0].escalated);
await db.$disconnect();
