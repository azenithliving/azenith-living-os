/**
 * apply-p6-migration.mjs — apply a P6 migration file over DIRECT_URL.
 *
 * The Supabase CLI needs an interactive token and psql is not installable on
 * this network, so migrations run through the Prisma client that is already in
 * the project. Migrations must not be executed blindly, so this tool:
 *
 *  • DRY-RUNS by default — it prints what it *would* run and the before-state
 *    of the owner stamps. Nothing is written without `--apply`.
 *  • splits on `--SPLIT--` lines (a ";\n" splitter destroys `DO $$ … $$`
 *    blocks) and strips `--` comment lines from each fragment.
 *  • substitutes {{TOKEN}} placeholders from the environment or --set.
 *  • verifies afterwards from the database itself, not from the file.
 *
 * Secrets: the connection string is read from .env.local and never printed.
 * The company id is printed truncated to 8 chars — it is an identifier, not a
 * credential, but there is no reason to echo it in full.
 *
 * Usage:
 *   node scripts/apply-p6-migration.mjs supabase/migrations/20260925_p6_one_store.sql
 *   node scripts/apply-p6-migration.mjs <file> --apply
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const l of readFileSync(resolve(REPO, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("-"));
const APPLY = args.includes("--apply");
const tokens = {};
args.forEach((a, i) => {
  const m = /^--set=([^=]+)=(.*)$/.exec(a);
  if (m) tokens[m[1]] = m[2];
});
// The store's id is a configuration fact, already in .env.local — reading it
// from there keeps it off the command line (argv leaks into shell history and
// process listings) and makes `--set` the escape hatch for a deliberate change.
if (!tokens.P6_CANONICAL && env.ADMIN_COMPANY_ID) tokens.P6_CANONICAL = env.ADMIN_COMPANY_ID;
if (!file) {
  console.error("usage: node scripts/apply-p6-migration.mjs <migration.sql> [--apply] [--set=KEY=value]");
  process.exit(2);
}
if (!env.DIRECT_URL) {
  console.error("DIRECT_URL missing from .env.local");
  process.exit(2);
}

const raw = readFileSync(resolve(REPO, file), "utf8");
let body = raw
  .split(/^--SPLIT--\s*$/m)
  .flatMap((chunk) => {
    const clean = chunk
      .split(/\r?\n/)
      .filter((l) => !/^\s*--/.test(l))
      .join("\n")
      .trim();
    if (!clean) return [];
    // Any dollar-quoted body ( $$, $fn$, $body$ … ) is one statement. Checking
    // only for "$$" split a CREATE FUNCTION … $fn$ … $fn$ into fragments.
    return /\$\w*\$/.test(clean) ? [clean] : clean.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
  });

for (const [k, v] of Object.entries(tokens)) body = body.map((s) => s.replaceAll(`{{${k}}}`, v));
for (const s of body) {
  for (const m of s.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)) {
    console.error(`unresolved placeholder {{${m[1]}}} — pass --set=${m[1]}=…`);
    process.exit(2);
  }
}

console.log(`${APPLY ? "APPLYING" : "DRY RUN (nothing will be written)"} — ${file}`);
console.log(`statements: ${body.length}`);
body.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.replace(/\s+/g, " ").slice(0, 74)}`));

const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const stampReport = async (label) => {
  const canon = env.ADMIN_COMPANY_ID;
  const ZERO1 = "00000000-0000-0000-0000-000000000001";
  const ZERO0 = "00000000-0000-0000-0000-000000000000";
  const tabs = await prisma.$queryRawUnsafe(
    `SELECT c.table_name AS t FROM information_schema.columns c
       JOIN information_schema.tables tb ON tb.table_schema=c.table_schema AND tb.table_name=c.table_name
      WHERE c.table_schema='public' AND c.column_name='company_id' AND tb.table_type='BASE TABLE'
        AND c.table_name NOT IN ('companies','p6_store_company')
        -- snapshots hold the pre-migration stamps by design; counting them
        -- would report the problem as still present after a clean run
        AND c.table_name NOT LIKE '\_p6\_backup\_%' ESCAPE '\' ORDER BY 1`
  );
  let offStore = 0;
  const worst = [];
  for (const { t } of tabs) {
    try {
      const [r] = await prisma.$queryRawUnsafe(
        `SELECT count(*) FILTER (WHERE company_id IS DISTINCT FROM $1::uuid)::int AS bad FROM public."${t}"`,
        canon
      );
      if (r.bad) {
        offStore += r.bad;
        worst.push(`${t}=${r.bad}`);
      }
    } catch { /* column not uuid — skip */ }
  }
  console.log(`\n[${label}] صفوف خارج الخبرة ${canon?.slice(0, 8)}… : ${offStore}${worst.length ? `  (${worst.slice(0, 12).join(", ")})` : ""}`);
  const [site] = await prisma.$queryRawUnsafe(
    `SELECT count(*) FILTER (WHERE company_id::text='${ZERO1}')::int AS z1,
            count(*) FILTER (WHERE company_id::text='${ZERO0}')::int AS z0,
            count(*) FILTER (WHERE company_id IS NULL)::int AS nul,
            count(*)::int AS total FROM public.room_sections`
  );
  console.log(`  أقسام الغرف: zero1=${site.z1} zero0=${site.z0} null=${site.nul} total=${site.total}`);
};

await stampReport("قبل");

if (!APPLY) {
  console.log("\ndry run انتهى — أعد بنفس الأمر مع --apply للكتابة الفعلية.");
  await prisma.$disconnect();
  process.exit(0);
}

for (let i = 0; i < body.length; i++) {
  const head = body[i].replace(/\s+/g, " ").slice(0, 60);
  try {
    await prisma.$executeRawUnsafe(body[i]);
    console.log(`  [${i + 1}] OK   ${head}`);
  } catch (e) {
    console.log(`  [${i + 1}] FAIL ${head} :: ${String(e.message).replace(/\s+/g, " ").slice(0, 160)}`);
    await prisma.$disconnect();
    process.exit(1);
  }
}

await stampReport("بعد");
const seeded = await prisma.$queryRawUnsafe(
  `SELECT company_id::text AS id, note FROM public.p6_store_company WHERE single_row`
);
console.log(`  p6_store_company: ${seeded.map((s) => `${s.id.slice(0, 8)}… (${s.note})`).join("") || "EMPTY"}`);
const trig = await prisma.$queryRawUnsafe(
  `SELECT count(*)::int AS c FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'p6_store_company_guard' AND n.nspname = 'public' AND NOT t.tgisinternal`
);
console.log(`  حارس الخبرة مُركّب على ${trig[0].c} جدول`);
await prisma.$disconnect();
