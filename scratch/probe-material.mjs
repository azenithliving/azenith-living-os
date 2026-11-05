import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const t = await db.$queryRawUnsafe(`select table_name from information_schema.tables where table_schema='public' and (table_name ilike '%material%' or table_name ilike '%fabric%' or table_name ilike '%finish%' or table_name ilike '%color%' or table_name ilike '%palette%')`);
console.log('material tables: ' + (t.length ? t.map((r) => r.table_name).join(', ') : 'NONE'));
const c = await db.$queryRawUnsafe(`select count(*)::bigint n from public.curated_images where metadata ? 'avg_color'`);
console.log('images with avg_color: ' + String(c[0].n));
const d = await db.$queryRawUnsafe(`select count(distinct metadata->>'avg_color')::bigint n from public.curated_images where is_active`);
console.log('distinct avg_color: ' + String(d[0].n));
await db.$disconnect();
