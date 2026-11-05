/**
 * The second customer place, measured before anything is moved into the first: what the
 * lead ledger actually holds, how full each column is, and whether a row carries something
 * that identifies a human at all. Counts and column names only.
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
    where table_schema='public' and table_name='leads' order by ordinal_position`);
console.log("leads columns:", columns.length);
for (const c of columns) console.log(`  ${c.column_name} :: ${c.data_type}${c.is_nullable === "YES" ? "" : " (required)"}`);

const rows = await db.$queryRawUnsafe(`select * from public.leads`);
console.log("rows:", rows.length);
for (const c of columns) {
  const filled = rows.filter((r) => r[c.column_name] !== null && String(r[c.column_name]).trim() !== "").length;
  console.log(`  filled ${c.column_name}: ${filled}/${rows.length}`);
}

const identifiable = rows.filter((r) => {
  const phone = String(r.phone ?? "").replace(/\D/g, "");
  return /^1[0125]\d{8}$/.test(phone.replace(/^00?20/, "").replace(/^0/, "")) || String(r.email ?? "").includes("@");
}).length;
console.log("rows carrying a phone or an email (a human, not a guess):", identifiable, "of", rows.length);

const oldest = await db.$queryRawUnsafe(`select min(created_at) as first_row, max(created_at) as last_row from public.leads`);
console.log("first row:", String(oldest[0].first_row ?? "-"), "| newest row:", String(oldest[0].last_row ?? "-"));

await db.$disconnect();
