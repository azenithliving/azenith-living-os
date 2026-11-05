import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const one = async (s) => (await db.$queryRawUnsafe(s))[0];
const c = async (s) => String((await one(s)).c);
console.log('sketches            ', await c(`select count(*)::bigint c from public.room_sketches`));
console.log('with token          ', await c(`select count(*)::bigint c from public.room_sketches where token is not null`));
console.log('with customer_key   ', await c(`select count(*)::bigint c from public.room_sketches where coalesce(customer_key,'') <> ''`));
console.log('sealed              ', await c(`select count(*)::bigint c from public.room_sketches where frozen_hash is not null`));
console.log('ok                  ', await c(`select count(*)::bigint c from public.room_sketches where ok`));
console.log('room_type values    ', (await db.$queryRawUnsafe(`select room_type, count(*)::bigint c from public.curated_images where is_active group by room_type order by c desc limit 10`)).map((r)=>r.room_type+"="+String(r.c)).join(", "));
console.log('style values        ', (await db.$queryRawUnsafe(`select style, count(*)::bigint c from public.curated_images where is_active group by style order by c desc limit 10`)).map((r)=>r.room_type+"="+String(r.c)).join(", "));
console.log('source values       ', (await db.$queryRawUnsafe(`select source, count(*)::bigint c from public.curated_images where is_active group by source order by c desc limit 8`)).map((r)=>r.source+"="+String(r.c)).join(", "));
const md = await db.$queryRawUnsafe(`select metadata from public.curated_images where is_active and metadata is not null limit 3`);
for (const r of md) console.log('metadata sample     ', JSON.stringify(r.metadata).slice(0, 220));
console.log('quality_score set   ', await c(`select count(*)::bigint c from public.curated_images where is_active and quality_score is not null`));
await db.$disconnect();
