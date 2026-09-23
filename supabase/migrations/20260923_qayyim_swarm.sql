-- QAYYIM SWARM MIGRATION (Phase 3 — Maturity)
-- Creates tables for: experiments (A/B), swarm goals, telemetry events,
-- benchmark results, observability metrics, proactive suggestions.

-- 1. Experiments table (A/B testing engine persistence)
CREATE TABLE IF NOT EXISTS public.qayyim_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    experiment_key VARCHAR(120) NOT NULL,
    hypothesis TEXT NOT NULL,
    page_path VARCHAR(500) NOT NULL,
    section_key VARCHAR(120) NOT NULL,
    control_version JSONB NOT NULL,
    variant_version JSONB NOT NULL,
    success_metric VARCHAR(60) NOT NULL DEFAULT 'conversion_rate',
    minimum_detectable_effect NUMERIC(6,3) DEFAULT 10.0,
    duration_days INTEGER DEFAULT 14,
    traffic_split NUMERIC(4,3) DEFAULT 0.5, -- fraction going to variant
    status VARCHAR(30) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','running','paused','completed','cancelled','winner_declared')),
    winner VARCHAR(20) CHECK (winner IN ('control','variant','inconclusive')),
    statistical_confidence NUMERIC(5,4),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_by VARCHAR(120) DEFAULT 'qayyim-ux',
    results JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, experiment_key)
);

-- 2. Experiment assignment + conversion events
CREATE TABLE IF NOT EXISTS public.qayyim_experiment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES public.qayyim_experiments(id) ON DELETE CASCADE,
    visitor_id VARCHAR(120) NOT NULL,
    arm VARCHAR(20) NOT NULL CHECK (arm IN ('control','variant')),
    event_type VARCHAR(40) NOT NULL CHECK (event_type IN ('impression','conversion','exit','scroll')),
    event_value NUMERIC,
    page_path VARCHAR(500),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Swarm goals (QAYYIM-UX conversion goals)
CREATE TABLE IF NOT EXISTS public.qayyim_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    name VARCHAR(255) NOT NULL,
    target_metric VARCHAR(60) NOT NULL,
    target_value NUMERIC NOT NULL,
    current_value NUMERIC DEFAULT 0,
    page_path VARCHAR(500),
    section_key VARCHAR(120),
    deadline TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','achieved','missed','cancelled')),
    progress_history JSONB DEFAULT '[]',
    created_by VARCHAR(120) DEFAULT 'qayyim-ux',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Telemetry events (visitor behavior — append-only)
CREATE TABLE IF NOT EXISTS public.qayyim_telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    visitor_id VARCHAR(120),
    session_id VARCHAR(120),
    page_path VARCHAR(500) NOT NULL,
    section_key VARCHAR(120),
    event_type VARCHAR(60) NOT NULL, -- scroll_depth, exit, hover, click, time_on_section
    event_value NUMERIC,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Benchmark results (quality benchmarks for agent outputs)
CREATE TABLE IF NOT EXISTS public.qayyim_benchmark_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    agent_key VARCHAR(60) NOT NULL,
    benchmark_key VARCHAR(120) NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
    passed BOOLEAN NOT NULL DEFAULT false,
    details JSONB DEFAULT '{}',
    run_duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Observability: agent task metrics (feeds ObservabilityDashboard)
CREATE TABLE IF NOT EXISTS public.qayyim_task_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    agent_key VARCHAR(60) NOT NULL,
    task_id VARCHAR(120) NOT NULL,
    task_type VARCHAR(80),
    status VARCHAR(30) NOT NULL CHECK (status IN ('started','completed','failed')),
    duration_ms INTEGER,
    tokens_used INTEGER,
    quality_gate_result VARCHAR(20),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Proactive suggestions (surface in admin UI)
CREATE TABLE IF NOT EXISTS public.qayyim_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    source_agent VARCHAR(60) NOT NULL,
    suggestion_type VARCHAR(60) NOT NULL, -- identity_fix, seo_gap, perf_regression, ab_opportunity
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed','converted_to_draft')),
    evidence JSONB DEFAULT '{}',
    action_payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_qayyim_experiments_status ON public.qayyim_experiments (company_id, status);
CREATE INDEX IF NOT EXISTS idx_qayyim_exp_events_exp ON public.qayyim_experiment_events (experiment_id, event_type);
CREATE INDEX IF NOT EXISTS idx_qayyim_exp_events_visitor ON public.qayyim_experiment_events (experiment_id, visitor_id);
CREATE INDEX IF NOT EXISTS idx_qayyim_goals_status ON public.qayyim_goals (company_id, status);
CREATE INDEX IF NOT EXISTS idx_qayyim_telemetry_page ON public.qayyim_telemetry_events (company_id, page_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qayyim_telemetry_section ON public.qayyim_telemetry_events (page_path, section_key, event_type);
CREATE INDEX IF NOT EXISTS idx_qayyim_bench_agent ON public.qayyim_benchmark_runs (agent_key, benchmark_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qayyim_task_metrics_agent ON public.qayyim_task_metrics (agent_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qayyim_suggestions_status ON public.qayyim_suggestions (company_id, status, priority);

-- 9. Updated-at triggers
CREATE OR REPLACE FUNCTION public.qayyim_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_qayyim_experiments_touch ON public.qayyim_experiments;
CREATE TRIGGER trg_qayyim_experiments_touch BEFORE UPDATE ON public.qayyim_experiments
    FOR EACH ROW EXECUTE FUNCTION public.qayyim_touch_updated_at();

DROP TRIGGER IF EXISTS trg_qayyim_goals_touch ON public.qayyim_goals;
CREATE TRIGGER trg_qayyim_goals_touch BEFORE UPDATE ON public.qayyim_goals
    FOR EACH ROW EXECUTE FUNCTION public.qayyim_touch_updated_at();

-- 10. RLS (service role full access; authenticated read-only for their company)
ALTER TABLE public.qayyim_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qayyim_experiment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qayyim_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qayyim_telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qayyim_benchmark_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qayyim_task_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qayyim_suggestions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'qayyim_experiments','qayyim_experiment_events','qayyim_goals',
        'qayyim_telemetry_events','qayyim_benchmark_runs','qayyim_task_metrics','qayyim_suggestions'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I_service_all ON public.%I', t, t);
        EXECUTE format(
            'CREATE POLICY %I_service_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t, t);
    END LOOP;
END $$;
