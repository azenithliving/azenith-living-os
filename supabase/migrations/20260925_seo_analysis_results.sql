-- P5 Product test: seo_analysis_results table was never created, so every
-- seo_analyze run failed with PGRST205 at saveSEOAnalysisToDatabase
-- (lib/seo-analyzer.ts:978). Columns mirror SEOAnalysisResultInsert exactly.
-- execution_id has NO FK: analyzeSEO may run with a client-supplied execution
-- uuid that isn't present in agent_executions (an UPDATE there is best-effort).

CREATE TABLE IF NOT EXISTS public.seo_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  page_title TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  score_breakdown JSONB,
  meta_tags JSONB,
  meta_issues JSONB,
  headings_structure JSONB,
  headings_issues JSONB,
  images_analysis JSONB,
  images_issues JSONB,
  links_analysis JSONB,
  links_issues JSONB,
  performance_metrics JSONB,
  performance_issues JSONB,
  recommendations JSONB,
  analysis_status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_analysis_results_company_created
  ON public.seo_analysis_results (company_id, created_at DESC);

ALTER TABLE public.seo_analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_seo_analysis_results" ON public.seo_analysis_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);
