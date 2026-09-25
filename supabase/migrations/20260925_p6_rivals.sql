-- P6-M2 «عيون على السوق» — competitor watch tables.
--
-- Polite by construction: the crawler (lib/qayyim/rivals.ts) honours robots.txt,
-- caps pages per run, and stores only public page facts — no prices scraped
-- behind logins, no personal data. Rows are company-scoped like the rest of the
-- qayyim_* tables; snapshots keep history so a digest can say what CHANGED.
--
-- Re-runnable: CREATE ... IF NOT EXISTS everywhere, and the policy creation is
-- wrapped because Postgres has no CREATE POLICY IF NOT EXISTS (a second run
-- would otherwise die on 42710).
--
-- NOTE FOR APPLICATORS: statements are separated by lines containing exactly
-- --SPLIT-- . A naive ";\n" splitter breaks inside the DO $$ ... $$ block.

--SPLIT--
CREATE TABLE IF NOT EXISTS public.qayyim_rivals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qayyim_rivals_company_url_key UNIQUE (company_id, url)
);

CREATE INDEX IF NOT EXISTS idx_qayyim_rivals_company_enabled
  ON public.qayyim_rivals (company_id, enabled);

--SPLIT--
ALTER TABLE public.qayyim_rivals ENABLE ROW LEVEL SECURITY;

--SPLIT--
CREATE TABLE IF NOT EXISTS public.qayyim_rival_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rival_id UUID NOT NULL REFERENCES public.qayyim_rivals(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  crawled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'completed',
  error TEXT,
  pages_crawled INTEGER NOT NULL DEFAULT 0,
  summary JSONB
);

CREATE INDEX IF NOT EXISTS idx_qayyim_rival_snapshots_rival_time
  ON public.qayyim_rival_snapshots (rival_id, crawled_at DESC);

--SPLIT--
ALTER TABLE public.qayyim_rival_snapshots ENABLE ROW LEVEL SECURITY;

--SPLIT--
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qayyim_rivals'
      AND policyname = 'service_role_qayyim_rivals'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_qayyim_rivals" ON public.qayyim_rivals FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END
$$;

--SPLIT--
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qayyim_rival_snapshots'
      AND policyname = 'service_role_qayyim_rival_snapshots'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_qayyim_rival_snapshots" ON public.qayyim_rival_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END
$$;
