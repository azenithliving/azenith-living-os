import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const str = async (s) => String((await db.$queryRawUnsafe(s))[0].c);
console.log('products rows        ', await str(`select count(*)::bigint c from public.products`));
console.log('products priced      ', await str(`select count(*)::bigint c from public.products where coalesce(sale_price, base_price) is not null`));
console.log('products active      ', await str(`select count(*)::bigint c from public.products where coalesce(sale_price, base_price) is not null and (coalesce(is_active,true)=true)`));
const cols = await db.$queryRawUnsafe(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='products' order by ordinal_position`);
console.log('products cols        ', cols.map((c) => c.column_name).join(' '));
console.log('bom_headers          ', await str(`select count(*)::bigint c from public.bom_headers`));
console.log('bom_items            ', await str(`select count(*)::bigint c from public.bom_items`));
console.log('sales_order_items    ', await str(`select count(*)::bigint c from public.sales_order_items`));
const locCols = await db.$queryRawUnsafe(`select table_name, column_name from information_schema.columns where table_schema='public' and (column_name ilike '%city%' or column_name ilike '%area%' or column_name ilike '%governorate%' or column_name ilike '%location%' or column_name ilike '%region%') order by table_name`);
console.log('geo columns          ', locCols.map((r) => r.table_name + '.' + r.column_name).join(', ').slice(0, 400));
const leadCols = await db.$queryRawUnsafe(`select column_name from information_schema.columns where table_schema='public' and table_name='leads' order by ordinal_position`);
console.log('leads cols           ', leadCols.map((r) => r.column_name).join(' '));
console.log('leads rows           ', await str(`select count(*)::bigint c from public.leads`));
await db.$disconnect();
