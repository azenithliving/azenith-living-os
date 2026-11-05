/**
 * Record the two facts the owner dictated on 2026-10-02 into the store's own knowledge, where he
 * can read and edit them from the sales screen: working hours, and that the store has no
 * showroom because everything is made to order.
 *
 * Written through the same table the admin knowledge tab uses, with a parameterised insert.
 * Prints what it wrote and how many rows the store now carries.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const FACTS = [
  "مواعيد العمل: كل أيام الأسبوع من ٩ صباحًا حتى ٨ مساءً، ما عدا الجمعة.",
  "الدار ملهاش معرض ولا منتجات جاهزة للبيع: كل الشغل بيتصمّم وبيتصنّع حسب الطلب وعلى مقاس العميل.",
];

for (const instruction of FACTS) {
  const existing = await db.$queryRaw`select id from consultant_learnings where instruction = ${instruction} limit 1`;
  if (existing.length) {
    console.log(`already recorded: ${instruction.slice(0, 48)}…`);
    continue;
  }
  await db.$executeRaw`insert into consultant_learnings (instruction, created_at) values (${instruction}, now())`;
  console.log(`recorded: ${instruction.slice(0, 48)}…`);
}

const rows = await db.$queryRaw`select count(*)::int as n from consultant_learnings`;
console.log(`knowledge rows now: ${Number(rows[0].n)}`);
await db.$disconnect();
