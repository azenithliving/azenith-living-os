import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const rows = await db.$queryRawUnsafe(`select id, room, ok, confirmed_count, area_sqm, dimensions, openings, customer_dimensions, frozen_hash is not null as sealed from public.room_sketches order by created_at desc limit 19`);
for (const r of rows) console.log(r.id, '|', r.room, '| ok=' + r.ok, '| conf=' + r.confirmed_count, '| area=' + r.area_sqm, '| sealed=' + r.sealed,
  '| dims=' + JSON.stringify(r.dimensions).slice(0, 130), '| open=' + JSON.stringify(r.openings).slice(0, 90), '| cust=' + JSON.stringify(r.customer_dimensions).slice(0, 90));
await db.$disconnect();
