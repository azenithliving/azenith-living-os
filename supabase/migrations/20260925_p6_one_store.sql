-- P6 «محل واحد» — one store, one owner stamp.
--
-- Why: the same business was written under three different company ids (and 12
-- rows carry none). Any read that filters by one id therefore describes part of
-- the shop as empty — that is where «فحصت 0 غرفة» came from. This file
-- consolidates onto the id the server is configured with, keeps a restorable
-- snapshot of every table it touches, and then installs a guard so future rows
-- cannot pick a wrong stamp again.
--
-- SAFETY
--  • `_p6_backup_<table>` holds the full pre-migration copy of each touched
--    table, created only if absent — re-running never overwrites the snapshot.
--  • `{{P6_CANONICAL}}` is replaced with the configured company id by
--    scripts/apply-p6-migration.mjs (never guessed, never hardcoded in the repo).
--    After the seed statement below, every step reads the id from
--    `p6_store_company`, so the file is re-runnable as-is.
--  • Rollback = restore from the backup table, e.g.
--      UPDATE public.room_sections r SET company_id = b.company_id
--        FROM public._p6_backup_room_sections b WHERE b.id = r.id;
--
-- Statements are separated by lines containing exactly  --SPLIT--
-- (a naive ";\n" splitter breaks inside the DO $$ … $$ blocks).

--SPLIT--
CREATE TABLE IF NOT EXISTS public.p6_store_company (
  single_row boolean PRIMARY KEY DEFAULT true,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  CONSTRAINT p6_store_company_single CHECK (single_row)
);

INSERT INTO public.p6_store_company (company_id, note)
VALUES ('{{P6_CANONICAL}}'::uuid, 'الخبرة الموحدة للدّار — تُقرأ من إعدادات الخادم عند الترحيل')
ON CONFLICT (single_row) DO NOTHING;

--SPLIT--
ALTER TABLE public.p6_store_company ENABLE ROW LEVEL SECURITY;

--SPLIT--
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='p6_store_company' AND policyname='service_role_p6_store_company') THEN
    EXECUTE 'CREATE POLICY "service_role_p6_store_company" ON public.p6_store_company FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='p6_store_company' AND policyname='public_read_p6_store_company') THEN
    EXECUTE 'CREATE POLICY "public_read_p6_store_company" ON public.p6_store_company FOR SELECT TO public USING (true)';
  END IF;
END
$$;

--SPLIT--
-- snapshots (IF NOT EXISTS keeps the original pre-migration state on re-runs)
CREATE TABLE IF NOT EXISTS public._p6_backup_room_sections        AS SELECT * FROM public.room_sections;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_users                AS SELECT * FROM public.users;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_events               AS SELECT * FROM public.events;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_requests             AS SELECT * FROM public.requests;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_products             AS SELECT * FROM public.products;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_sales_orders         AS SELECT * FROM public.sales_orders;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_qayyim_drafts        AS SELECT * FROM public.qayyim_drafts;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_qayyim_suggestions   AS SELECT * FROM public.qayyim_suggestions;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_qayyim_benchmark_runs AS SELECT * FROM public.qayyim_benchmark_runs;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_agent_profiles        AS SELECT * FROM public.agent_profiles;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_agent_devices         AS SELECT * FROM public.agent_devices;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_agent_tasks           AS SELECT * FROM public.agent_tasks;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_agent_conversations   AS SELECT * FROM public.agent_conversations;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_enterprise_agents     AS SELECT * FROM public.enterprise_agents;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_consultant_sessions   AS SELECT * FROM public.consultant_sessions;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_leads                 AS SELECT * FROM public.leads;
--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_production_jobs       AS SELECT * FROM public.production_jobs;

--SPLIT--
-- the consolidation itself: content first, accounts last is the order the
-- operator runs, but a single statement per table keeps each one auditable.
DO $$
DECLARE
  canon uuid;
  t text;
  moved int;
  tables text[] := ARRAY[
    'room_sections','events','requests','products','sales_orders','qayyim_drafts',
    'qayyim_suggestions','qayyim_benchmark_runs','agent_profiles','agent_devices',
    'agent_tasks','agent_conversations','consultant_sessions',
    'leads','production_jobs','users'
  ];
BEGIN
  SELECT company_id INTO canon FROM public.p6_store_company WHERE single_row LIMIT 1;
  IF canon IS NULL THEN
    RAISE EXCEPTION 'p6_store_company is not seeded — refusing to consolidate';
  END IF;
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'UPDATE public.%I SET company_id = $1 WHERE company_id IS DISTINCT FROM $1', t
    ) USING canon;
    GET DIAGNOSTICS moved = ROW_COUNT;
    RAISE NOTICE 'وحّد %: % صف', t, moved;
  END LOOP;
END
$$;

--SPLIT--
-- the guard: from now on a row that arrives without a stamp, or with a retired
-- one, is normalised to the store's id. This is what stops the problem coming
-- back when a future change forgets to set company_id.
CREATE OR REPLACE FUNCTION public.p6_enforce_store_company()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  canon uuid;
BEGIN
  SELECT company_id INTO canon FROM public.p6_store_company WHERE single_row LIMIT 1;
  IF canon IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.company_id IS NULL OR NEW.company_id <> canon THEN
    NEW.company_id := canon;
  END IF;
  RETURN NEW;
END
$fn$;

--SPLIT--
DO $$
DECLARE
  t text;
  -- `enterprise_agents` is intentionally absent: it is a VIEW over a table
  -- already in this list, and Postgres rejects row triggers on views.
  tables text[] := ARRAY[
    'room_sections','events','requests','products','sales_orders','qayyim_drafts',
    'qayyim_suggestions','qayyim_benchmark_runs','agent_profiles','agent_devices',
    'agent_tasks','agent_conversations','consultant_sessions',
    'leads','production_jobs','users'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS p6_store_company_guard ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER p6_store_company_guard BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.p6_enforce_store_company()', t);
  END LOOP;
END
$$;
