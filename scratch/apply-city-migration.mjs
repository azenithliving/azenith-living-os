import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const sql = fs.readFileSync('supabase/migrations/20261003_a_customer_city.sql', 'utf8');
await db.$executeRawUnsafe(sql);
const before = await db.$queryRawUnsafe(`select count(*)::int n from information_schema.columns where table_schema='public' and table_name='room_sketches'`);
await db.$executeRawUnsafe(sql); // idempotency: apply twice
const after = await db.$queryRawUnsafe(`select count(*)::int n from information_schema.columns where table_schema='public' and table_name='room_sketches'`);
const col = await db.$queryRawUnsafe(`select data_type, is_nullable from information_schema.columns where table_schema='public' and table_name='room_sketches' and column_name='customer_city'`);
console.log('columns before/after:', String(before[0].n), String(after[0].n), '| customer_city:', JSON.stringify(col));
await db.$disconnect();
