-- Migration 006: Monthly Refresh System Tables (FIXED)

-- 1. جدول سجل التجديدات
CREATE TABLE IF NOT EXISTS public.refresh_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'running')),
    duration_minutes NUMERIC(10, 2),
    images_before INTEGER DEFAULT 0,
    images_after INTEGER DEFAULT 0,
    deleted_count INTEGER DEFAULT 0,
    added_count INTEGER DEFAULT 0,
    report JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. جدول نسخ احتياطية
CREATE TABLE IF NOT EXISTS public.image_backups (
    id TEXT PRIMARY KEY,
    image_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. جدول استخدام API
CREATE TABLE IF NOT EXISTS public.api_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    request_count INTEGER DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(provider, key_hash, date)
);

-- 4. دالة الفحص (مصححة)
CREATE OR REPLACE FUNCTION public.should_run_monthly_refresh()
RETURNS BOOLEAN 
LANGUAGE plpgsql 
STABLE AS $$
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

-- 5. دالة تاريخ آخر تشغيل
CREATE OR REPLACE FUNCTION public.get_last_refresh_date()
RETURNS TIMESTAMPTZ 
LANGUAGE plpgsql 
STABLE AS $$
DECLARE 
    last_run TIMESTAMPTZ;
BEGIN
    SELECT MAX(created_at) INTO last_run 
    FROM public.refresh_logs 
    WHERE status = 'success';
    
    RETURN last_run;
END;
$$;

-- 6. فحص النتيجة
SELECT 
    'Migration 006 Applied Successfully' as status,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_name IN ('refresh_logs', 'image_backups', 'api_usage_log')) as tables_count,
    (SELECT public.should_run_monthly_refresh()) as should_run_now;
