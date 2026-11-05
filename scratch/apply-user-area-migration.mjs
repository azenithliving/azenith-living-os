import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

/**
 * Applies the customer-area column and proves it landed — twice, to show it is idempotent.
 *   node scratch/apply-user-area-migration.mjs
 * Reads the column back from the database; the script never reports from its own intention.
 */
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const sql = fs.readFileSync("supabase/migrations/20261008_a_user_area.sql", "utf8");

const before = await db.$queryRawUnsafe(
  `select count(*)::int n from information_schema.columns where table_schema='public' and table_name='users'`,
);
await db.$executeRawUnsafe(sql);
const once = await db.$queryRawUnsafe(
  `select data_type, is_nullable from information_schema.columns where table_schema='public' and table_name='users' and column_name='area'`,
);
await db.$executeRawUnsafe(sql);
const after = await db.$queryRawUnsafe(
  `select count(*)::int n from information_schema.columns where table_schema='public' and table_name='users'`,
);
console.log("الأعمدة قبل/بعد التطبيق التاني:", String(before[0].n), String(after[0].n));
console.log("العمود area:", JSON.stringify(once));
await db.$disconnect();
