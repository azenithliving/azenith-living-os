import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const p = await db.$queryRawUnsafe(`select agent_key, count(*)::bigint c from public.agent_profiles group by agent_key order by agent_key`);
console.log('agent_profiles: ' + p.map((r) => r.agent_key + '=' + String(r.c)).join(' · '));
const m = await db.$queryRawUnsafe(`select agent_key, count(*)::bigint c from public.agent_messages group by agent_key order by c desc limit 14`);
console.log('agent_messages: ' + m.map((r) => r.agent_key + '=' + String(r.c)).join(' · '));
await db.$disconnect();
