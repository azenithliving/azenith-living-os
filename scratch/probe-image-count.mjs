import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const one = async (s) => (await db.$queryRawUnsafe(s))[0];
const n = async (s) => String((await one(s)).c);
console.log('curated_images rows      ', await n(`select count(*)::bigint c from public.curated_images`));
console.log('active                   ', await n(`select count(*)::bigint c from public.curated_images where is_active`));
console.log('distinct url             ', await n(`select count(distinct url)::bigint c from public.curated_images`));
console.log('distinct thumb           ', await n(`select count(distinct thumbnail_url)::bigint c from public.curated_images`));
const src = await db.$queryRawUnsafe(`select source, count(*)::bigint c, count(*) filter (where is_active)::bigint active from public.curated_images group by source order by c desc`);
console.log('by source                ', src.map((r) => `${r.source}=${String(r.c)}/${String(r.active)}`).join(' · '));
const tables = await db.$queryRawUnsafe(`select table_name from information_schema.tables where table_schema='public' and (table_name ilike '%image%' or table_name ilike '%photo%' or table_name ilike '%media%' or table_name ilike '%harvest%' or table_name ilike '%pexels%')`);
console.log('image-ish tables         ', tables.map((r) => r.table_name).join(', '));
for (const t of tables.map((r) => r.table_name)) {
  if (t === 'curated_images') continue;
  try { console.log(`  ${t.padEnd(26)} rows`, await n(`select count(*)::bigint c from public."${t}"`)); } catch { console.log(`  ${t} unreadable`); }
}
await db.$disconnect();
