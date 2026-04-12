-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║                    AZENITH PRIME - Database Schema                        ║
-- ║              الكيان الأعلى • العقل الكوني • التطور الذاتي              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ==========================================
-- 1. SWARM KEYS - Infinite Scaling Engine
-- ==========================================
CREATE TABLE IF NOT EXISTS swarm_keys (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    key_value TEXT NOT NULL,
    model TEXT NOT NULL,
    specialty TEXT NOT NULL DEFAULT 'luxury_content',
    intelligence INTEGER DEFAULT 50,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cooldown', 'exhausted')),
    last_used TIMESTAMPTZ DEFAULT NOW(),
    success_rate DECIMAL(3,2) DEFAULT 1.0,
    cost_per_request DECIMAL(10,4) DEFAULT 0.01,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast active key lookup
CREATE INDEX IF NOT EXISTS idx_swarm_keys_status ON swarm_keys(status);
CREATE INDEX IF NOT EXISTS idx_swarm_keys_provider ON swarm_keys(provider);
CREATE INDEX IF NOT EXISTS idx_swarm_keys_intelligence ON swarm_keys(intelligence DESC);

-- Function to get available key
CREATE OR REPLACE FUNCTION get_available_swarm_key(p_provider TEXT)
RETURNS TABLE (key_id TEXT, key_value TEXT, key_model TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT sk.id, sk.key_value, sk.model
    FROM swarm_keys sk
    WHERE sk.provider = p_provider
      AND sk.status = 'active'
      AND (sk.last_used < NOW() - INTERVAL '1 second' OR sk.success_rate > 0.9)
    ORDER BY sk.intelligence DESC, sk.success_rate DESC
    LIMIT 1;
    
    -- Update last_used
    UPDATE swarm_keys
    SET last_used = NOW()
    WHERE id = (SELECT key_id FROM get_available_swarm_key(p_provider) LIMIT 1);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 2. TIME CAPSULES - Atomic State Snapshots
-- ==========================================
CREATE TABLE IF NOT EXISTS time_capsules (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('manual', 'auto', 'pre_change')),
    description TEXT NOT NULL,
    emotional_context TEXT,
    rollback_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_time_capsules_created ON time_capsules(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_capsules_rollback ON time_capsules(rollback_available) WHERE rollback_available = true;

-- ==========================================
-- 3. NEURAL CACHE - Semantic Memory (99% API Reduction)
-- ==========================================
CREATE TABLE IF NOT EXISTS neural_cache (
    semantic_hash TEXT PRIMARY KEY,
    exact_match TEXT NOT NULL,
    near_matches TEXT[] DEFAULT '{}',
    response TEXT NOT NULL,
    context TEXT,
    usage_count INTEGER DEFAULT 1,
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    emotional_weight DECIMAL(3,2) DEFAULT 0.5,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for semantic search
CREATE INDEX IF NOT EXISTS idx_neural_cache_usage ON neural_cache(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_neural_cache_accessed ON neural_cache(last_accessed DESC);

-- Function to increment cache usage
CREATE OR REPLACE FUNCTION increment_neural_cache_usage(p_semantic_hash TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE neural_cache
    SET usage_count = usage_count + 1,
        last_accessed = NOW()
    WHERE semantic_hash = p_semantic_hash;
END;
$$ LANGUAGE plpgsql;

-- Function to get cache stats
CREATE OR REPLACE FUNCTION get_neural_cache_stats()
RETURNS TABLE (
    total_entries BIGINT,
    total_hits BIGINT,
    hit_rate DECIMAL(5,2),
    saved_cost DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_entries,
        SUM(usage_count - 1)::BIGINT as total_hits,
        (SUM(usage_count - 1)::DECIMAL / NULLIF(SUM(usage_count), 0) * 100)::DECIMAL(5,2) as hit_rate,
        (SUM((usage_count - 1) * 0.02))::DECIMAL(10,2) as saved_cost
    FROM neural_cache;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 4. IMPERIAL NOTIFICATIONS - Cross-Continental Alerts
-- ==========================================
CREATE TABLE IF NOT EXISTS imperial_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    action_url TEXT,
    read BOOLEAN DEFAULT false,
    sent_to_push BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Index for unread notifications
CREATE INDEX IF NOT EXISTS idx_imperial_notifications_unread ON imperial_notifications(read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_imperial_notifications_priority ON imperial_notifications(priority, created_at DESC);

-- Function to mark as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE imperial_notifications
    SET read = true,
        read_at = NOW()
    WHERE id = p_notification_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 5. SOUL MEMORY - User Ambitions & Concerns
-- ==========================================
CREATE TABLE IF NOT EXISTS soul_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('ambition', 'concern', 'preference', 'emotional_state')),
    content TEXT NOT NULL,
    emotional_weight DECIMAL(3,2) DEFAULT 0.5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user memories
CREATE INDEX IF NOT EXISTS idx_soul_memory_user ON soul_memory(user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_soul_memory_recent ON soul_memory(created_at DESC);

-- ==========================================
-- 6. MARKET OPPORTUNITIES - Profit Analysis
-- ==========================================
CREATE TABLE IF NOT EXISTS market_opportunities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('feature', 'optimization', 'trend', 'competitive')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    philosophy TEXT NOT NULL,
    estimated_revenue INTEGER DEFAULT 0,
    estimated_users INTEGER DEFAULT 0,
    brand_impact INTEGER DEFAULT 0,
    implementation_complexity INTEGER DEFAULT 50,
    ready_to_deploy BOOLEAN DEFAULT false,
    preview_url TEXT,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    deployed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'deployed'))
);

-- Index for opportunities
CREATE INDEX IF NOT EXISTS idx_market_opportunities_ready ON market_opportunities(ready_to_deploy) WHERE ready_to_deploy = true;
CREATE INDEX IF NOT EXISTS idx_market_opportunities_revenue ON market_opportunities(estimated_revenue DESC);
CREATE INDEX IF NOT EXISTS idx_market_opportunities_status ON market_opportunities(status);

-- ==========================================
-- 7. AI MODEL TRACKER - Self-Evolution Engine
-- ==========================================
CREATE TABLE IF NOT EXISTS ai_model_tracker (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    capabilities TEXT[] DEFAULT '{}',
    intelligence INTEGER DEFAULT 50,
    speed INTEGER DEFAULT 50,
    cost_per_request DECIMAL(10,4) DEFAULT 0.01,
    release_date TIMESTAMPTZ,
    quality_score INTEGER DEFAULT 0,
    integrated BOOLEAN DEFAULT false,
    integrated_at TIMESTAMPTZ,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    last_evaluated TIMESTAMPTZ
);

-- Index for model tracking
CREATE INDEX IF NOT EXISTS idx_ai_model_tracker_integrated ON ai_model_tracker(integrated);
CREATE INDEX IF NOT EXISTS idx_ai_model_tracker_quality ON ai_model_tracker(quality_score DESC);

-- Function to integrate new model
CREATE OR REPLACE FUNCTION integrate_ai_model(p_model_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE ai_model_tracker
    SET integrated = true,
        integrated_at = NOW()
    WHERE id = p_model_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 8. ENABLE RLS (Row Level Security)
-- ==========================================
ALTER TABLE swarm_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_capsules ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE imperial_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE soul_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_tracker ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admin full access on swarm_keys"
    ON swarm_keys FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access on time_capsules"
    ON time_capsules FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access on neural_cache"
    ON neural_cache FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access on imperial_notifications"
    ON imperial_notifications FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access on soul_memory"
    ON soul_memory FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access on market_opportunities"
    ON market_opportunities FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access on ai_model_tracker"
    ON ai_model_tracker FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- ==========================================
-- 9. VIEWS FOR DASHBOARD
-- ==========================================

-- Swarm intelligence view
CREATE OR REPLACE VIEW v_swarm_intelligence AS
SELECT 
    COUNT(*) as total_keys,
    COUNT(*) FILTER (WHERE status = 'active') as active_keys,
    AVG(intelligence)::INTEGER as avg_intelligence,
    AVG(success_rate)::DECIMAL(3,2) as avg_success_rate,
    SUM(cost_per_request) as total_cost_capacity
FROM swarm_keys;

-- Neural cache efficiency view
CREATE OR REPLACE VIEW v_neural_cache_efficiency AS
SELECT 
    COUNT(*) as total_entries,
    SUM(usage_count) as total_usage,
    SUM(usage_count - 1) as cache_hits,
    (SUM(usage_count - 1)::DECIMAL / NULLIF(SUM(usage_count), 0) * 100)::DECIMAL(5,2) as hit_rate_percent,
    SUM((usage_count - 1) * 0.02)::DECIMAL(10,2) as estimated_savings
FROM neural_cache;

-- Prime status summary view
CREATE OR REPLACE VIEW v_prime_status AS
SELECT 
    (SELECT total_keys FROM v_swarm_intelligence) as swarm_size,
    (SELECT avg_intelligence FROM v_swarm_intelligence) as collective_intelligence,
    (SELECT hit_rate_percent FROM v_neural_cache_efficiency) as cache_hit_rate,
    (SELECT estimated_savings FROM v_neural_cache_efficiency) as cost_saved,
    (SELECT COUNT(*) FROM time_capsules WHERE rollback_available = true) as available_capsules,
    (SELECT COUNT(*) FROM market_opportunities WHERE status = 'pending' AND ready_to_deploy = true) as ready_opportunities,
    (SELECT COUNT(*) FROM ai_model_tracker WHERE integrated = true) as integrated_models;

-- ==========================================
-- 10. COMMENTS FOR DOCUMENTATION
-- ==========================================
COMMENT ON TABLE swarm_keys IS 'Infinite scaling engine - swarm intelligence keys';
COMMENT ON TABLE time_capsules IS 'Time capsule system for atomic state snapshots';
COMMENT ON TABLE neural_cache IS 'Semantic neural cache for 99% API reduction';
COMMENT ON TABLE imperial_notifications IS 'Cross-continental push notifications';
COMMENT ON TABLE soul_memory IS 'User ambitions, concerns, and emotional state';
COMMENT ON TABLE market_opportunities IS 'Market analysis and profit opportunities';
COMMENT ON TABLE ai_model_tracker IS 'Self-evolution engine - AI model tracking';
