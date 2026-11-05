/**
 * How many conversations in the store's own records are my probes, not real customers?
 *   node scratch/count-probe-sessions.mjs
 *
 * Read-only. Prints two numbers: the sessions created today, and how many of them carry one of
 * the six questions my instruments ask. Deleting them is the owner's word, not mine — so the
 * count is what gets reported, and it is measured, not remembered.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

/** Distinctive fragments of the six questions the voice instrument asks. */
const FRAGMENTS = [
  "خطوات الشغل معاكم",
  "الفرق بين الركنة المودرن والكلاسيك",
  "خامات النيش والمطبخ",
  "ركن مودرن للصة",
  "بتشتغلوا في التجمع ولا القاهرة الجديدة",
  "ميزانية محدودة لشقة",
];

const where = FRAGMENTS.map((_, i) => `messages::text like $${i + 1}`).join(" or ");

const probe = await db.$queryRawUnsafe(
  `select count(*)::int as n from consultant_sessions
    where created_at >= current_date and (${where})`,
  ...FRAGMENTS.map((f) => `%${f}%`)
);

const today = await db.$queryRawUnsafe(
  `select count(*)::int as n from consultant_sessions where created_at >= current_date`
);

const ever = await db.$queryRawUnsafe(
  `select count(*)::int as n from consultant_sessions where (${where})`,
  ...FRAGMENTS.map((f) => `%${f}%`)
);

const liveProbe = await db.$queryRawUnsafe(
  `select count(*)::int as n from consultant_sessions where session_id like 'live-probe-%'`
);

console.log(`sessions created today      : ${today[0].n}`);
console.log(`  of them my six questions   : ${probe[0].n}`);
console.log(`my six questions, all time   : ${ever[0].n}`);
console.log(`older live-probe- sessions   : ${liveProbe[0].n}`);

await db.$disconnect();
