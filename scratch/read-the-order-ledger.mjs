/**
 * What would it take to attach an order to the human who placed it? This reads the order
 * ledger's own shape from the live database: which columns exist, how full each one is,
 * which keys it already points at, and whether any column carries something that reads
 * like a phone number. Counts and column names only — never a customer value.
 *
 * Read-only.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const columns = await db.$queryRawUnsafe(
  `select column_name, data_type, is_nullable from information_schema.columns
    where table_schema='public' and table_name='sales_orders' order by ordinal_position`);
console.log("sales_orders columns:", columns.length);
for (const c of columns) console.log(`  ${c.column_name} :: ${c.data_type}${c.is_nullable === "YES" ? "" : " (required)"}`);

const rows = await db.$queryRawUnsafe(`select * from public.sales_orders`);
console.log("rows:", rows.length);
for (const c of columns) {
  const filled = rows.filter((r) => r[c.column_name] !== null && String(r[c.column_name]).trim() !== "").length;
  console.log(`  filled ${c.column_name}: ${filled}/${rows.length}`);
}

// Does any column hold something that reads like an Egyptian mobile? Report only which
// column and how many rows, not the number itself.
for (const c of columns) {
  const withPhone = rows.filter((r) => /(?:\+?20)?0?1[0125]\d{8}/.test(String(r[c.column_name] ?? ""))).length;
  if (withPhone) console.log(`  phone-shaped values in ${c.column_name}: ${withPhone}`);
}

const fks = await db.$queryRawUnsafe(
  `select tc.constraint_name, kcu.column_name, ccu.table_name as references_table
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
     join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    where tc.constraint_type='FOREIGN KEY' and tc.table_name='sales_orders'`);
console.log("outgoing keys:", fks.length);
for (const f of fks) console.log(`  ${f.column_name} -> ${f.references_table}`);

const incoming = await db.$queryRawUnsafe(
  `select rel.relname as table_with_key, att.attname as column_name, con.conname
     from pg_constraint con
     join pg_class rel on rel.oid = con.conrelid
     join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
     join pg_class tgt on tgt.oid = con.confrelid
    where con.contype='f' and tgt.relname='sales_orders'`);
console.log("pointing at orders:", incoming.length);
for (const f of incoming) console.log(`  ${f.table_name}.${f.column_name}`);

await db.$disconnect();
