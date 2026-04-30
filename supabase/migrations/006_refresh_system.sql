-- Migration 006: Monthly Refresh System Tables
-- Purpose: Support automated image refresh every 30 days

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- REFRESH LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.refresh_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'running')),
    duration_minutes NUMERIC(10, 2),
    images_before INTEGER DEFAULT 0,
    images_after INTEGER DEFAULT 0,
    deleted_count INTEGER DEFAULT 0,
    added_count INTEGER DEFAULT 0,
    report JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Index for recent logs
CREATE INDEX IF NOT EXISTS idx_refresh_logs_created_at 
    ON public.refresh_logs(created_at DESC);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_refresh_logs_status 
    ON public.refresh_logs(status);

-- ============================================
-- IMAGE BACKUPS METADATA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.image_backups (
    id TEXT PRIMARY KEY,
    image_count INTEGER NOT NULL,
    storage_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================
-- API USAGE LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL CHECK (provider IN ('pexels', 'gemini', 'groq', 'openai')),
    key_hash TEXT NOT NULL,
    request_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    remaining_quota INTEGER,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Unique constraint per provider per key per date
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_usage_unique 
    ON public.api_usage_log(provider, key_hash, date);

-- Index for daily stats
CREATE INDEX IF NOT EXISTS idx_api_usage_date 
    ON public.api_usage_log(date DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.refresh_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

-- Admin access policies
CREATE POLICY refresh_logs_admin_access 
    ON public.refresh_logs FOR ALL TO authenticated USING (true);

CREATE POLICY image_backups_admin_access 
    ON public.image_backups FOR ALL TO authenticated USING (true);

CREATE POLICY api_usage_admin_access 
    ON public.api_usage_log FOR ALL TO authenticated USING (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if refresh is needed (30 days passed)
CREATE OR REPLACE FUNCTION public.should_run_monthly_refresh()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
    last_run TIMESTAMPTZ;
    days_passed INTEGER;
BEGIN
    SELECT MAX(created_at) INTO last_run
    FROM public.refresh_logs
    WHERE status = 'success';
    
    IF last_run IS NULL THEN
        RETURN true;
    END IF;
    
    days_passed := EXTRACT(DAY FROM (timezone('utc', now()) - last_run));
    RETURN days_passed >= 30;
END;
$$;

-- Function to get next scheduled refresh
CREATE OR REPLACE FUNCTION public.get_next_refresh_date()
RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE AS $$
DECLARE
    last_run TIMESTAMPTZ;
BEGIN
    SELECT MAX(created_at) INTO last_run
    FROM public.refresh_logs
    WHERE status = 'success';
    
    IF last_run IS NULL THEN
        RETURN timezone('utc', now());
    END IF;
    
    RETURN last_run + INTERVAL '30 days';
END;
$$;

-- Function to log API usage
CREATE OR REPLACE FUNCTION public.log_api_usage(
    p_provider TEXT,
    p_key_hash TEXT,
    p_requests INTEGER,
    p_success INTEGER,
    p_failed INTEGER,
    p_remaining INTEGER
)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.api_usage_log (
        provider, key_hash, request_count, success_count, 
        failed_count, remaining_quota, date
    ) VALUES (
        p_provider, p_key_hash, p_requests, p_success,
        p_failed, p_remaining, CURRENT_DATE
    )
    ON CONFLICT (provider, key_hash, date)
    DO UPDATE SET
        request_count = public.api_usage_log.request_count + p_requests,
        success_count = public.api_usage_log.success_count + p_success,
        failed_count = public.api_usage_log.failed_count + p_failed,
        remaining_quota = p_remaining;
END;
$$;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 
    'Migration 006 Applied Successfully' as status,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_name IN ('refresh_logs', 'image_backups', 'api_usage_log')) as tables_created;
