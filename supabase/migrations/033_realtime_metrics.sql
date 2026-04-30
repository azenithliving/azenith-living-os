-- Migration: Real-time Metrics Support
-- Purpose: Enable real metrics tracking instead of estimates
-- Created: Phase 2 of Executive Agent 100% Real Implementation

-- ============================================
-- 1. Create visitor_sessions table for real analytics
-- ============================================

CREATE TABLE IF NOT EXISTS visitor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID NOT NULL,
    session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    page_views INTEGER DEFAULT 0,
    is_bounce BOOLEAN DEFAULT false,
    device_type VARCHAR(20), -- mobile, desktop, tablet
    browser VARCHAR(50),
    os VARCHAR(50),
    referrer VARCHAR(255),
    landing_page VARCHAR(255),
    exit_page VARCHAR(255),
    country VARCHAR(100),
    city VARCHAR(100),
    session_duration_seconds INTEGER,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for visitor_sessions
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor_id ON visitor_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_start ON visitor_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_company ON visitor_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_device ON visitor_sessions(device_type);

COMMENT ON TABLE visitor_sessions IS 'Tracks individual visitor sessions with real engagement metrics';

-- ============================================
-- 2. Create page_views table for detailed page tracking
-- ============================================

CREATE TABLE IF NOT EXISTS page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES visitor_sessions(id) ON DELETE CASCADE,
    page_path VARCHAR(255) NOT NULL,
    page_title VARCHAR(255),
    time_on_page_seconds INTEGER,
    scroll_depth_percent INTEGER,
    referrer VARCHAR(255),
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL
);

-- Indexes for page_views
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(page_path);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_page_views_company ON page_views(company_id);

COMMENT ON TABLE page_views IS 'Tracks individual page views with engagement metrics';

-- ============================================
-- 3. Create metrics_hourly aggregate table
-- ============================================

CREATE TABLE IF NOT EXISTS metrics_hourly (
    hour TIMESTAMP WITH TIME ZONE NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- visitors, page_views, conversions, bounce_rate, etc.
    value NUMERIC NOT NULL,
    dimension JSONB, -- {source: 'organic', device: 'mobile', campaign: 'summer_sale'}
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (hour, metric_type, company_id)
);

COMMENT ON TABLE metrics_hourly IS 'Hourly aggregated metrics for fast querying';

-- ============================================
-- 4. Create function to calculate real bounce rate
-- ============================================

CREATE OR REPLACE FUNCTION calculate_bounce_rate(
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE,
    p_company_id UUID DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
    v_total_sessions INTEGER;
    v_bounce_sessions INTEGER;
    v_bounce_rate NUMERIC;
BEGIN
    SELECT COUNT(*) INTO v_total_sessions
    FROM visitor_sessions
    WHERE session_start BETWEEN p_start_time AND p_end_time
      AND (p_company_id IS NULL OR company_id = p_company_id);
    
    IF v_total_sessions = 0 THEN
        RETURN 0;
    END IF;
    
    SELECT COUNT(*) INTO v_bounce_sessions
    FROM visitor_sessions
    WHERE session_start BETWEEN p_start_time AND p_end_time
      AND is_bounce = true
      AND (p_company_id IS NULL OR company_id = p_company_id);
    
    v_bounce_rate := (v_bounce_sessions::NUMERIC / v_total_sessions) * 100;
    
    RETURN ROUND(v_bounce_rate, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_bounce_rate IS 'Calculates real bounce rate from session data';

-- ============================================
-- 5. Create function to calculate avg session duration
-- ============================================

CREATE OR REPLACE FUNCTION calculate_avg_session_duration(
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE,
    p_company_id UUID DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
    v_avg_duration NUMERIC;
BEGIN
    SELECT AVG(session_duration_seconds)
    INTO v_avg_duration
    FROM visitor_sessions
    WHERE session_start BETWEEN p_start_time AND p_end_time
      AND session_duration_seconds IS NOT NULL
      AND (p_company_id IS NULL OR company_id = p_company_id);
    
    RETURN COALESCE(ROUND(v_avg_duration, 2), 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_avg_session_duration IS 'Calculates real average session duration';

-- ============================================
-- 6. Create function to calculate returning visitor rate
-- ============================================

CREATE OR REPLACE FUNCTION calculate_returning_visitor_rate(
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE,
    p_company_id UUID DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
    v_total_visitors INTEGER;
    v_returning_visitors INTEGER;
BEGIN
    WITH visitor_counts AS (
        SELECT visitor_id, COUNT(*) as session_count
        FROM visitor_sessions
        WHERE session_start BETWEEN p_start_time AND p_end_time
          AND (p_company_id IS NULL OR company_id = p_company_id)
        GROUP BY visitor_id
    )
    SELECT 
        COUNT(*) INTO v_total_visitors
    FROM visitor_counts;
    
    IF v_total_visitors = 0 THEN
        RETURN 0;
    END IF;
    
    SELECT 
        COUNT(*) INTO v_returning_visitors
    FROM visitor_counts
    WHERE session_count > 1;
    
    RETURN ROUND((v_returning_visitors::NUMERIC / v_total_visitors) * 100, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_returning_visitor_rate IS 'Calculates percentage of returning visitors';

-- ============================================
-- 7. Create comprehensive metrics calculation function
-- ============================================

CREATE OR REPLACE FUNCTION calculate_real_metrics(
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE,
    p_company_id UUID DEFAULT NULL
) RETURNS TABLE (
    metric_name TEXT,
    metric_value NUMERIC,
    details JSONB
) AS $$
BEGIN
    -- Total visitors
    RETURN QUERY
    SELECT 
        'total_visitors'::TEXT,
        COUNT(DISTINCT visitor_id)::NUMERIC,
        jsonb_build_object('period', 'custom', 'start', p_start_time, 'end', p_end_time)
    FROM visitor_sessions
    WHERE session_start BETWEEN p_start_time AND p_end_time
      AND (p_company_id IS NULL OR company_id = p_company_id);
    
    -- Unique visitors
    RETURN QUERY
    SELECT 
        'unique_visitors'::TEXT,
        COUNT(DISTINCT visitor_id)::NUMERIC,
        jsonb_build_object('total_sessions', COUNT(*))
    FROM visitor_sessions
    WHERE session_start BETWEEN p_start_time AND p_end_time
      AND (p_company_id IS NULL OR company_id = p_company_id);
    
    -- Total page views
    RETURN QUERY
    SELECT 
        'page_views'::TEXT,
        COUNT(*)::NUMERIC,
        jsonb_build_object('unique_pages', COUNT(DISTINCT page_path))
    FROM page_views pv
    JOIN visitor_sessions vs ON pv.session_id = vs.id
    WHERE vs.session_start BETWEEN p_start_time AND p_end_time
      AND (p_company_id IS NULL OR vs.company_id = p_company_id);
    
    -- Bounce rate
    RETURN QUERY
    SELECT 
        'bounce_rate'::TEXT,
        calculate_bounce_rate(p_start_time, p_end_time, p_company_id),
        jsonb_build_object('calculation_method', 'single_page_sessions / total_sessions');
    
    -- Average session duration
    RETURN QUERY
    SELECT 
        'avg_session_duration'::TEXT,
        calculate_avg_session_duration(p_start_time, p_end_time, p_company_id),
        jsonb_build_object('unit', 'seconds');
    
    -- Returning visitor rate
    RETURN QUERY
    SELECT 
        'returning_visitor_rate'::TEXT,
        calculate_returning_visitor_rate(p_start_time, p_end_time, p_company_id),
        jsonb_build_object('unit', 'percent');
    
    -- Pages per session
    RETURN QUERY
    SELECT 
        'pages_per_session'::TEXT,
        ROUND(AVG(page_views)::NUMERIC, 2),
        jsonb_build_object(
            'min', MIN(page_views),
            'max', MAX(page_views)
        )
    FROM visitor_sessions
    WHERE session_start BETWEEN p_start_time AND p_end_time
      AND (p_company_id IS NULL OR company_id = p_company_id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_real_metrics IS 'Calculates all real metrics for a given time period';

-- ============================================
-- 8. Create function to aggregate metrics hourly
-- ============================================

CREATE OR REPLACE FUNCTION aggregate_metrics_hourly(
    p_hour TIMESTAMP WITH TIME ZONE,
    p_company_id UUID DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_record RECORD;
BEGIN
    FOR v_record IN 
        SELECT * FROM calculate_real_metrics(p_hour, p_hour + INTERVAL '1 hour', p_company_id)
    LOOP
        INSERT INTO metrics_hourly (hour, metric_type, value, dimension, company_id)
        VALUES (
            p_hour,
            v_record.metric_name,
            v_record.metric_value,
            v_record.details,
            p_company_id
        )
        ON CONFLICT (hour, metric_type, company_id)
        DO UPDATE SET 
            value = EXCLUDED.value,
            dimension = EXCLUDED.dimension,
            updated_at = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aggregate_metrics_hourly IS 'Aggregates metrics for a specific hour';

-- ============================================
-- 9. Create trigger to auto-update session duration
-- ============================================

CREATE OR REPLACE FUNCTION update_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.session_end IS NOT NULL AND NEW.session_start IS NOT NULL THEN
        NEW.session_duration_seconds := EXTRACT(EPOCH FROM (NEW.session_end - NEW.session_start))::INTEGER;
        
        -- Mark as bounce if only 1 page view and short duration
        IF NEW.page_views <= 1 AND NEW.session_duration_seconds < 10 THEN
            NEW.is_bounce := true;
        END IF;
    END IF;
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_session_duration_trigger ON visitor_sessions;

CREATE TRIGGER update_session_duration_trigger
    BEFORE UPDATE ON visitor_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_duration();

-- ============================================
-- 10. Enable RLS on new tables
-- ============================================

ALTER TABLE visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_hourly ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your security requirements)
CREATE POLICY "visitor_sessions_company_policy" ON visitor_sessions
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "page_views_company_policy" ON page_views
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "metrics_hourly_company_policy" ON metrics_hourly
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 11. Create view for real-time dashboard
-- ============================================

CREATE OR REPLACE VIEW v_realtime_metrics AS
SELECT 
    'last_24h' as period,
    (SELECT COUNT(DISTINCT visitor_id) FROM visitor_sessions 
     WHERE session_start > NOW() - INTERVAL '24 hours') as unique_visitors,
    (SELECT COUNT(*) FROM page_views 
     WHERE viewed_at > NOW() - INTERVAL '24 hours') as page_views,
    calculate_bounce_rate(NOW() - INTERVAL '24 hours', NOW()) as bounce_rate,
    calculate_avg_session_duration(NOW() - INTERVAL '24 hours', NOW()) as avg_session_duration,
    calculate_returning_visitor_rate(NOW() - INTERVAL '24 hours', NOW()) as returning_visitor_rate,
    NOW() as calculated_at;

COMMENT ON VIEW v_realtime_metrics IS 'Real-time metrics for dashboard display';
