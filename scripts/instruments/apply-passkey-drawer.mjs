#!/usr/bin/env node
/**
 * apply-passkey-drawer.mjs — create the door-key desk in the live record, measured before and after.
 *
 * Phase three's rule: a migration is worth applying only with a measurement on both sides, read from
 * the database itself, never from the file. And the owner's brake: no table, no column, no row is ever
 * dropped — so the guard runs before anything connects, and this file refuses to run at all if the
 * SQL contains a drop, a truncate or a delete.
 *
 * Usage:
 *   node scripts/instruments/apply-passkey-drawer.mjs            dry run — prints, writes nothing
 *   node scripts/instruments/apply-passkey-drawer.mjs --apply    runs the statements, reads back
 * The connection string is read from .env.local and never printed.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

import { findDestructive, splitStatements } from "../../lib/build/migration-sql.ts";

const FILE = "supabase/migrations/20261106_passkey_credentials.sql";
const TABLE = "user_public_keys";
const EXPECTED_COLUMNS = [
  "id",
  "user_id",
  "credential_id",
  "credential_public_key",
  "public_key",
  "key_type",
  "aaguid",
  "counter",
  "device_type",
  "backed_up",
  "transports",
  "origin",
  "label",
  "created_at",
  "last_used_at",
];

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);
if (!env.DIRECT_URL) {
  console.error("DIRECT_URL missing من .env.local — القياس ما اتعملش");
  process.exit(2);
}

const APPLY = process.argv.includes("--apply");
const statements = splitStatements(readFileSync(FILE, "utf8"));

const destructive = findDestructive(statements);
if (destructive.length) {
  console.error(`مرفوض: الترحيل فيه ${destructive.length} أمر حذف — مفيش حاجة اتنفذتش`);
  for (const hit of destructive) console.error(`  ${hit.word}: ${hit.statement.slice(0, 90)}`);
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const readState = async (label) => {
  const exists = await prisma.$queryRawUnsafe(
    `select count(*)::int as n from information_schema.tables where table_schema='public' and table_name=$1`,
    TABLE,
  );
  const cols = await prisma.$queryRawUnsafe(
    `select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`,
    TABLE,
  );
  const rls = await prisma.$queryRawUnsafe(
    `select relrowsecurity from pg_class where relname=$1`,
    TABLE,
  );
  const policies = await prisma.$queryRawUnsafe(
    `select count(*)::int as n from pg_policies where schemaname='public' and tablename=$1`,
    TABLE,
  );
  console.log(
    `[${label}] الجدول ${exists[0].n ? "موجود" : "مش موجود"} · الأعمدة ${cols.length} · قفل الصفوف ${rls.length ? String(rls[0].relrowsecurity) : "—"} · السياسات ${policies[0]?.n ?? 0}`,
  );
  if (cols.length) console.log(`  ${cols.map((c) => c.column_name).join(", ")}`);
  return cols.map((c) => c.column_name);
};

console.log(`${APPLY ? "APPLYING" : "DRY RUN — مفيش حاجة هتتكتب"} · ${FILE} · ${statements.length} أمر`);
statements.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.replace(/\s+/g, " ").slice(0, 78)}`));

const before = await readState("قبل");

if (!APPLY) {
  console.log("\ndry run انتهى — أعد بنفس الأمر مع --apply للكتابة الفعلية.");
  await prisma.$disconnect();
  process.exit(0);
}

for (const [i, statement] of statements.entries()) {
  try {
    await prisma.$executeRawUnsafe(statement);
  } catch (error) {
    console.error(`الأمر ${i + 1} فشل: ${String(error).slice(0, 200)}`);
    await readState("بعد الجزئي");
    await prisma.$disconnect();
    process.exit(1);
  }
}

const after = await readState("بعد");
const missing = EXPECTED_COLUMNS.filter((column) => !after.includes(column));
if (missing.length) {
  console.error(`مرفوض-النتيجة: الأعمدة دي ناقصة بعد الترحيل: ${missing.join(", ")}`);
  await prisma.$disconnect();
  process.exit(1);
}
console.log(`OK: ${EXPECTED_COLUMNS.length} عمود موجودين، والقراية من information_schema نفسها.`);
console.log(`  اتزود ${after.filter((c) => !before.includes(c)).length} عمود ما كانش موجود قبل الترحيل.`);
await prisma.$disconnect();
