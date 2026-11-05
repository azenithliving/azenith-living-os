import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const since = await db.$queryRawUnsafe(`select to_char(date_trunc('hour', created_at),'YYYY-MM-DD HH24:00') h, count(*)::bigint c from public.curated_images where created_at > now() - interval '6 hours' group by h order by h`);
console.log('images stored per hour, last 6h:');
for (const r of since) console.log('  ', r.h, String(r.c));
const total = await db.$queryRawUnsafe(`select count(*)::bigint c from public.curated_images`);
console.log('bank total now:', String(total[0].c));
await db.$disconnect();
