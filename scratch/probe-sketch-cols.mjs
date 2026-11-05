import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const cols = await db.$queryRawUnsafe(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='room_sketches' order by ordinal_position`);
console.log(cols.map((c) => `${c.column_name}:${c.data_type}`).join('  '));
const rows = await db.$queryRawUnsafe(`select witnesses from public.room_sketches where witnesses is not null order by created_at desc limit 3`);
for (const r of rows) console.log(JSON.stringify(r.witnesses).slice(0, 500));
await db.$disconnect();
