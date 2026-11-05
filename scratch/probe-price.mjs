import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const cols = await db.$queryRawUnsafe(`select table_name, column_name from information_schema.columns where table_schema='public' and column_name ilike '%price%' or table_schema='public' and column_name ilike '%cost%' order by table_name`);
const by = {};
for (const r of cols) (by[r.table_name] ||= []).push(r.column_name);
console.log('price/cost columns: ' + JSON.stringify(by));
const prod = await db.$queryRawUnsafe(`select table_name from information_schema.tables where table_schema='public' and (table_name ilike '%product%' or table_name ilike '%catalog%' or table_name ilike '%item%' or table_name ilike '%order%')`);
console.log('commerce tables: ' + prod.map((r) => r.table_name).join(', '));
const so = await db.$queryRawUnsafe(`select * from public.sales_orders order by 1 desc limit 2`);
for (const r of so) console.log('order: ' + JSON.stringify(r).slice(0, 300));
await db.$disconnect();
