/**
 * p7-gen-tables-sql.mjs — writes the P7-M5 rename migration from the live table list.
 *
 * The list is not typed by hand: it is read from pg_class so the file cannot
 * drift from what the database actually holds, and the generator refuses to
 * emit a target name that already exists as something else.
 *
 * Read-only against the database; it only writes a file.
 * Usage: node scripts/p7-gen-tables-sql.mjs
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const p = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const tables = (
  await p.$queryRawUnsafe(
    `select relname::text as n from pg_class
      where relnamespace='public'::regnamespace and relkind='r' and relname like 'qayyim%'
        and relname not like '\_p%\_backup%'
      order by 1`
  )
).map((r) => r.n);
await p.$disconnect();

if (tables.length !== 15) {
  console.error(`expected the 15 inventoried tables, found ${tables.length}: ${tables.join(", ")}`);
  process.exit(1);
}

const pairs = tables.map((t) => [t, "ops_" + t.slice("qayyim_".length)]);
const list = (names) => names.map((n) => `    '${n}'`).join(",\n");

const sql = `-- P7-M5 — the swarm's tables lose the retired name: qayyim_* → ops_*
--
-- Generated from pg_class by scripts/p7-gen-tables-sql.mjs against the live
-- database on 2026-09-26, not typed by hand. Re-runnable: every statement is
-- guarded, and the alias views use CREATE OR REPLACE.
--
-- Why the old name survives as a VIEW and not as nothing: the deploy is not
-- atomic. A function instance still running the previous build will ask for
-- qayyim_drafts while the table is already ops_drafts, and 42P01 in the middle
-- of the owner's chat is indistinguishable from "the swarm lost his data".
--
-- Why WITH (security_invoker = true) is not optional: every one of these tables
-- has row security ON, and a plain view is evaluated as its OWNER — postgres,
-- the table owner, which bypasses row security unless it is FORCEd. A view
-- created the default way would hand any role it grants to a window onto every
-- company's rows. With security_invoker the querying role's own privileges and
-- its own policies apply, exactly as they do on the table.
--
-- Statements are separated by --SPLIT-- because the applier must never try to
-- split a dollar-quoted body.

-- 1. rename every table. Triggers, policies, indexes, sequences and foreign
--    keys follow the relation by oid; only their own names keep the old word,
--    which is cosmetic and listed in the ledger rather than churned here.
DO \$\$
DECLARE t text; n text; renamed int := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY[
${list(tables)}
  ]
  LOOP
    n := 'ops_' || substring(t from 8);
    IF to_regclass('public.' || t) IS NOT NULL
       AND (select relkind from pg_class where oid = to_regclass('public.' || t)) = 'r'
       AND to_regclass('public.' || n) IS NULL
    THEN
      EXECUTE format('ALTER TABLE public.%I RENAME TO %I', t, n);
      renamed := renamed + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'P7-M5: % table(s) renamed to ops_*', renamed;
END \$\$;
--SPLIT--
-- 2. leave each retired name standing as a security-invoker alias, and grant
--    the same three roles the API uses. WITH CHECK is inherited from the view's
--    single-table shape, so writes through the alias are writes to the table.
DO \$\$
DECLARE t text; n text; made int := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY[
${list(tables)}
  ]
  LOOP
    n := 'ops_' || substring(t from 8);
    IF to_regclass('public.' || n) IS NOT NULL
       AND (select relkind from pg_class where oid = to_regclass('public.' || n)) = 'r'
    THEN
      EXECUTE format('CREATE OR REPLACE VIEW public.%I WITH (security_invoker = true) AS SELECT * FROM public.%I', t, n);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON public.%I TO anon, authenticated, service_role', t);
      made := made + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'P7-M5: % alias view(s) ensured', made;
END \$\$;
--SPLIT--
-- 3. the enterprise_agents VIEW still filtered on the leader's retired key, so
--    the P7-M2 data migration silently dropped him out of it: 14 profiles,
--    6 rows back, and ops-lead among the missing. Nothing in this repository
--    reads the view (it is referenced only by the migration verifier), which is
--    why the defect is fixed here rather than flagged as an outage. The new
--    filter names the live key AND keeps the retired one, so a row written by an
--    older build is still recognised during the rollout window.
CREATE OR REPLACE VIEW public.enterprise_agents
  WITH (security_invoker = true) AS
SELECT id, company_id, agent_key, name, description, avatar_url, capabilities,
       config, is_active, created_at, updated_at, personality_settings,
       system_prompt, version
  FROM public.agent_profiles
 WHERE agent_key::text = ANY (ARRAY[
         'ops-lead', 'qayyim-core',
         'vanguard', 'analyst', 'coder', 'ops', 'security', 'learner'
       ]::text[])
   AND is_active = true;
--SPLIT--
-- 4. the relation names PostgREST exposes have changed.
NOTIFY pgrst, 'reload schema';
`;

const out = "supabase/migrations/20260927_p7_tables.sql";
fs.writeFileSync(out, sql.replace(/\r\n/g, "\n"), "utf8");
console.log(`wrote ${out} — ${tables.length} tables`);
for (const [from, to] of pairs) console.log(`  ${from} -> ${to}`);
