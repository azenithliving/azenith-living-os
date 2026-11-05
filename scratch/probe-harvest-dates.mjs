import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const byDay = await db.$queryRawUnsafe(`select to_char(created_at,'YYYY-MM-DD') d, count(*)::bigint c from public.curated_images group by d order by d desc limit 14`);
console.log('rows by created_at (last 14 days with data):');
for (const r of byDay) console.log('  ', r.d, String(r.c));
const meta = await db.$queryRawUnsafe(`select metadata->>'harvested_at' h, count(*)::bigint c from public.curated_images group by h order by c desc limit 6`);
console.log('top harvested_at stamps:', meta.map((r) => `${(r.h || 'NULL').slice(0, 10)}=${String(r.c)}`).join(' · '));
const cats = await db.$queryRawUnsafe(`select room_type, count(*)::bigint c from public.curated_images group by room_type order by c asc`);
console.log('all room types ever:', cats.map((r) => `${r.room_type}=${String(r.c)}`).join(' · '));
await db.$disconnect();
