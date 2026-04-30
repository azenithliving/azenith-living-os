-- Migration 006: Sovereign OS Arsenal - Resource Management System
-- Implements: API Key Management, Semantic Caching Stats, System Health Monitoring

-- ============================================
-- 1. API KEYS ARSENAL - Centralized Key Management
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys_arsenal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Provider Section
    provider TEXT NOT NULL, -- 'groq', 'openrouter', 'mistral', 'pexels'
    
    -- Key Details (encrypted at application level)
    key_hash TEXT NOT NULL, -- SHA-256 hash for identification
    key_fragment TEXT NOT NULL, -- Last 8 chars for display (e.g., "...x7k9m2p3")
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cooling', 'disabled', 'failed'
    
    -- Usage Tracking
    total_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    
    -- Rate Limit Management
    rate_limit_per_minute INTEGER DEFAULT 60,
    current_minute_calls INTEGER DEFAULT 0,
    minute_window_start TIMESTAMPTZ DEFAULT NOW(),
    
    -- Cooldown Management
    cooldown_until TIMESTAMPTZ,
    cooldown_reason TEXT, -- 'rate_limit', 'auth_failure', 'manual'
    
    -- Failure Tracking
    consecutive_failures INTEGER DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    last_failure_reason TEXT,
    
    -- Processing Depth (Intelligence Scaling Engine)
    processing_depth INTEGER DEFAULT 1, -- 1=standard, 2=enhanced, 3=deep
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    
    UNIQUE(provider, key_hash)
);

-- ============================================
-- 2. SEMANTIC CACHE - Enhanced with Stats
-- ============================================
CREATE TABLE IF NOT EXISTS semantic_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Content
    content_hash TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL, -- 'translation', 'image_search', 'ai_generation', 'analysis'
    source_content TEXT NOT NULL,
    cached_result TEXT NOT NULL,
    
    -- Semantic Vector (for similarity search)
    -- Store as JSONB array of floats for pgvector compatibility
    embedding_vector JSONB,
    
    -- Context for better matching
    context_tags TEXT[], -- ['luxury', 'bedroom', 'modern']
    provider_used TEXT, -- Which API originally generated this
    
    -- Stats
    hit_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- NULL = permanent
    
    -- Quality Metrics
    quality_score NUMERIC(3,2) DEFAULT 1.00, -- 0.00 to 1.00
    user_feedback INTEGER -- User rating if provided
);

-- ============================================
-- 3. CACHE STATISTICS - Daily Aggregation
-- ============================================
CREATE TABLE IF NOT EXISTS cache_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- API Savings
    total_api_calls INTEGER DEFAULT 0,
    cached_hits INTEGER DEFAULT 0,
    api_savings_percent NUMERIC(5,2) DEFAULT 0, -- Calculated: (hits / (hits + calls)) * 100
    estimated_cost_saved NUMERIC(10,2) DEFAULT 0, -- USD
    
    -- Provider Breakdown
    groq_calls INTEGER DEFAULT 0,
    openrouter_calls INTEGER DEFAULT 0,
    mistral_calls INTEGER DEFAULT 0,
    pexels_calls INTEGER DEFAULT 0,
    
    -- Cache Health
    cache_entries_total INTEGER DEFAULT 0,
    cache_entries_expired INTEGER DEFAULT 0,
    avg_hit_count NUMERIC(7,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(snapshot_date)
);

-- ============================================
-- 4. SYSTEM HEALTH LOG - For Self-Healing
-- ============================================
CREATE TABLE IF NOT EXISTS system_health_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event Details
    event_type TEXT NOT NULL, -- 'key_failed', 'provider_depleted', 'failover_triggered', 'scale_down', 'scale_up', 'cache_cleared'
    provider TEXT, -- 'groq', 'openrouter', 'mistral', 'pexels', 'system'
    
    -- Severity
    severity TEXT NOT NULL, -- 'info', 'warning', 'critical'
    
    -- Details
    message TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    
    -- Recovery Actions
    action_taken TEXT, -- What the system did automatically
    action_successful BOOLEAN,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. PARALLEL TASK QUEUE - For Parallel Execution
-- ============================================
CREATE TABLE IF NOT EXISTS parallel_task_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Task Details
    task_type TEXT NOT NULL, -- 'translation_batch', 'image_search', 'content_generation'
    task_payload JSONB NOT NULL,
    
    -- Parallel Processing
    total_chunks INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    parent_task_id UUID REFERENCES parallel_task_queue(id),
    
    -- Assignment
    assigned_provider TEXT,
    assigned_key_id UUID REFERENCES api_keys_arsenal(id),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    result JSONB,
    error_message TEXT,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES (Performance)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys_arsenal(provider, status);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys_arsenal(status, cooldown_until);
CREATE INDEX IF NOT EXISTS idx_api_keys_available ON api_keys_arsenal(provider, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_semantic_cache_hash ON semantic_cache(content_hash);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_type ON semantic_cache(content_type, created_at);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_accessed ON semantic_cache(last_accessed DESC);

CREATE INDEX IF NOT EXISTS idx_cache_stats_date ON cache_statistics(snapshot_date);

CREATE INDEX IF NOT EXISTS idx_health_log_time ON system_health_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_log_severity ON system_health_log(severity, created_at);
CREATE INDEX IF NOT EXISTS idx_health_log_provider ON system_health_log(provider, event_type);

CREATE INDEX IF NOT EXISTS idx_task_queue_status ON parallel_task_queue(status, task_type);
CREATE INDEX IF NOT EXISTS idx_task_queue_parent ON parallel_task_queue(parent_task_id);

-- ============================================
-- RLS POLICIES (Security)
-- ============================================
ALTER TABLE api_keys_arsenal ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE parallel_task_queue ENABLE ROW LEVEL SECURITY;

-- Service role can manage everything
CREATE POLICY "Service role manage arsenal" ON api_keys_arsenal FOR ALL TO SERVICE_ROLE USING (true);
CREATE POLICY "Service role manage cache" ON semantic_cache FOR ALL TO SERVICE_ROLE USING (true);
CREATE POLICY "Service role manage stats" ON cache_statistics FOR ALL TO SERVICE_ROLE USING (true);
CREATE POLICY "Service role manage health" ON system_health_log FOR ALL TO SERVICE_ROLE USING (true);
CREATE POLICY "Service role manage tasks" ON parallel_task_queue FOR ALL TO SERVICE_ROLE USING (true);

-- Allow public read on cache for hit verification
CREATE POLICY "Public read semantic cache" ON semantic_cache FOR SELECT TO PUBLIC USING (true);

-- ============================================
-- TRIGGERS (Auto-update timestamps)
-- ============================================
CREATE TRIGGER update_api_keys_arsenal_updated_at BEFORE UPDATE ON api_keys_arsenal 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTIONS (Smart Operations)
-- ============================================

-- Function: Get Available Key with Load Balancing
CREATE OR REPLACE FUNCTION get_available_key(
    p_provider TEXT,
    p_processing_depth INTEGER DEFAULT 1
)
RETURNS TABLE (
    key_id UUID,
    key_hash TEXT,
    rate_limit INTEGER,
    processing_depth INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        aka.id,
        aka.key_hash,
        aka.rate_limit_per_minute,
        aka.processing_depth
    FROM api_keys_arsenal aka
    WHERE aka.provider = p_provider
        AND aka.status = 'active'
        AND (aka.cooldown_until IS NULL OR aka.cooldown_until <= NOW())
        AND (
            aka.minute_window_start < NOW() - INTERVAL '1 minute'
            OR aka.current_minute_calls < aka.rate_limit_per_minute
        )
        AND aka.processing_depth >= p_processing_depth
    ORDER BY 
        aka.last_used_at NULLS FIRST,
        aka.total_calls ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Record Cache Hit
CREATE OR REPLACE FUNCTION record_cache_hit(p_content_hash TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE semantic_cache
    SET hit_count = hit_count + 1,
        last_accessed = NOW()
    WHERE content_hash = p_content_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update API Key Usage
CREATE OR REPLACE FUNCTION update_key_usage(
    p_key_id UUID,
    p_success BOOLEAN,
    p_error_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_current_window TIMESTAMPTZ;
BEGIN
    v_current_window := date_trunc('minute', NOW());
    
    UPDATE api_keys_arsenal
    SET 
        total_calls = total_calls + 1,
        successful_calls = CASE WHEN p_success THEN successful_calls + 1 ELSE successful_calls END,
        failed_calls = CASE WHEN NOT p_success THEN failed_calls + 1 ELSE failed_calls END,
        last_used_at = NOW(),
        
        -- Reset minute window if needed
        current_minute_calls = CASE 
            WHEN minute_window_start < v_current_window THEN 1 
            ELSE current_minute_calls + 1 
        END,
        minute_window_start = CASE 
            WHEN minute_window_start < v_current_window THEN v_current_window 
            ELSE minute_window_start 
        END,
        
        -- Track failures
        consecutive_failures = CASE 
            WHEN p_success THEN 0 
            ELSE consecutive_failures + 1 
        END,
        last_failure_at = CASE 
            WHEN NOT p_success THEN NOW() 
            ELSE last_failure_at 
        END,
        last_failure_reason = CASE 
            WHEN NOT p_success THEN p_error_reason 
            ELSE last_failure_reason 
        END,
        
        -- Auto-cooldown on 3 consecutive failures
        status = CASE 
            WHEN NOT p_success AND consecutive_failures >= 2 THEN 'cooling'
            ELSE status 
        END,
        cooldown_until = CASE 
            WHEN NOT p_success AND consecutive_failures >= 2 THEN NOW() + INTERVAL '1 hour'
            ELSE cooldown_until 
        END,
        cooldown_reason = CASE 
            WHEN NOT p_success AND consecutive_failures >= 2 THEN 'consecutive_failures'
            ELSE cooldown_reason 
        END
    WHERE id = p_key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Log Health Event
CREATE OR REPLACE FUNCTION log_health_event(
    p_event_type TEXT,
    p_provider TEXT,
    p_severity TEXT,
    p_message TEXT,
    p_payload JSONB DEFAULT '{}',
    p_action_taken TEXT DEFAULT NULL,
    p_action_successful BOOLEAN DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO system_health_log (
        event_type, provider, severity, message, payload, action_taken, action_successful
    ) VALUES (
        p_event_type, p_provider, p_severity, p_message, p_payload, p_action_taken, p_action_successful
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get Arsenal Stats for HUD
CREATE OR REPLACE FUNCTION get_arsenal_stats()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'providers', (
            SELECT jsonb_object_agg(
                provider,
                jsonb_build_object(
                    'total', COUNT(*),
                    'active', COUNT(*) FILTER (WHERE status = 'active'),
                    'cooling', COUNT(*) FILTER (WHERE status = 'cooling'),
                    'disabled', COUNT(*) FILTER (WHERE status = 'disabled'),
                    'total_calls', COALESCE(SUM(total_calls), 0),
                    'success_rate', CASE 
                        WHEN SUM(total_calls) > 0 
                        THEN ROUND((SUM(successful_calls)::NUMERIC / SUM(total_calls)) * 100, 2)
                        ELSE 0 
                    END
                )
            )
            FROM api_keys_arsenal
            GROUP BY provider
        ),
        'cache_efficiency', (
            SELECT jsonb_build_object(
                'total_entries', COUNT(*),
                'total_hits', COALESCE(SUM(hit_count), 0),
                'avg_quality', ROUND(AVG(quality_score), 2),
                'today_savings', (
                    SELECT COALESCE(api_savings_percent, 0)
                    FROM cache_statistics
                    WHERE snapshot_date = CURRENT_DATE
                )
            )
            FROM semantic_cache
        ),
        'system_health', (
            SELECT jsonb_build_object(
                'critical_events_24h', COUNT(*) FILTER (WHERE severity = 'critical' AND created_at > NOW() - INTERVAL '24 hours'),
                'warnings_24h', COUNT(*) FILTER (WHERE severity = 'warning' AND created_at > NOW() - INTERVAL '24 hours'),
                'last_event', (
                    SELECT jsonb_build_object('type', event_type, 'message', message, 'at', created_at)
                    FROM system_health_log
                    ORDER BY created_at DESC
                    LIMIT 1
                )
            )
            FROM system_health_log
            WHERE created_at > NOW() - INTERVAL '24 hours'
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SEED DATA: Initialize Cache Stats
-- ============================================
INSERT INTO cache_statistics (snapshot_date)
VALUES (CURRENT_DATE)
ON CONFLICT (snapshot_date) DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 
    'Migration 006 Applied: Sovereign OS Arsenal' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (
        'api_keys_arsenal', 'semantic_cache', 'cache_statistics', 'system_health_log', 'parallel_task_queue'
    )) as tables_created,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN (
        'get_available_key', 'record_cache_hit', 'update_key_usage', 'log_health_event', 'get_arsenal_stats'
    )) as functions_created;
