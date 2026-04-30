-- Migration 072: SYSTEM TELEMETRY & HEALTH
-- "The omnipresence of observation: No failure shall go unnoticed"

-- 1. AI PROVIDER HEALTH
-- Tracks the status and balance of LLM providers
CREATE TABLE IF NOT EXISTS public.ai_provider_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name TEXT UNIQUE NOT NULL, -- 'groq', 'deepseek', 'openrouter', 'mistral'
    is_healthy BOOLEAN DEFAULT true,
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    balance_status TEXT DEFAULT 'sufficient', -- 'sufficient', 'low', 'empty'
    latency_ms INTEGER DEFAULT 0,
    last_checked TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EXECUTION TELEMETRY
-- Detailed logs of every genesis operation for autonomous learning
CREATE TABLE IF NOT EXISTS public.execution_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_type TEXT NOT NULL, -- 'genesis', 'schema_change', 'code_mutation'
    intent TEXT,
    provider_used TEXT,
    status TEXT NOT NULL, -- 'success', 'failure', 'fallback_triggered'
    error_message TEXT,
    execution_time_ms INTEGER,
    payload JSONB,
    result_snapshot JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_telemetry_status ON public.execution_telemetry(status);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON public.execution_telemetry(created_at);

-- RLS
ALTER TABLE public.ai_provider_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_telemetry" ON public.ai_provider_health FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_telemetry" ON public.execution_telemetry FOR ALL USING (true) WITH CHECK (true);

-- Seed initial provider health
INSERT INTO public.ai_provider_health (provider_name) 
VALUES ('groq'), ('deepseek'), ('openrouter'), ('mistral')
ON CONFLICT (provider_name) DO NOTHING;
