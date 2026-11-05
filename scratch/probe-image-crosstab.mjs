import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const rows = await db.$queryRawUnsafe(`select room_type, style, count(*)::bigint c from public.curated_images where is_active group by room_type, style order by room_type, style`);
console.log('combinations filled:', rows.length);
for (const r of rows) console.log(`  ${r.room_type.padEnd(24)} ${(r.style ?? 'NULL').padEnd(14)} ${String(r.c).padStart(5)} / 375`);
const under = rows.filter((r) => Number(r.c) < 375).length;
console.log('combinations under target:', under);
await db.$disconnect();
