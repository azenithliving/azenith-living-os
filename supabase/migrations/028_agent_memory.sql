-- Migration 028: Ultimate Agent Memory & Audit System
-- "Infinite memory, complete audit trail"

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AGENT MEMORY TABLE
-- Stores every decision, suggestion, outcome, and interaction
-- ============================================
CREATE TABLE IF NOT EXISTS agent_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'decision', 'suggestion', 'preference', 'goal', 'outcome', 
        'interaction', 'learning', 'anomaly', 'prediction'
    )),
    category VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    outcome VARCHAR(20) CHECK (outcome IN ('success', 'failure', 'pending', 'rejected')),
    user_feedback VARCHAR(20) CHECK (user_feedback IN ('positive', 'negative', 'neutral')),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_category ON agent_memory(category);
CREATE INDEX IF NOT EXISTS idx_agent_memory_priority ON agent_memory(priority);
CREATE INDEX IF NOT EXISTS idx_agent_memory_created_at ON agent_memory(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_outcome ON agent_memory(outcome);
CREATE INDEX IF NOT EXISTS idx_agent_memory_expires ON agent_memory(expires_at) WHERE expires_at IS NOT NULL;

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_agent_memory_content_search ON agent_memory USING gin(to_tsvector('english', content));

-- ============================================
-- USER PREFERENCES TABLE
-- Stores learned user preferences with confidence scores
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(100) NOT NULL,
    key VARCHAR(200) NOT NULL,
    value JSONB NOT NULL,
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    source VARCHAR(50) NOT NULL DEFAULT 'explicit' CHECK (source IN ('explicit', 'inferred', 'pattern')),
    last_confirmed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(category, key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_category ON user_preferences(category);
CREATE INDEX IF NOT EXISTS idx_user_preferences_confidence ON user_preferences(confidence DESC);

-- ============================================
-- AGENT GOALS TABLE
-- Tracks long-term goals and progress
-- ============================================
CREATE TABLE IF NOT EXISTS agent_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    target_metric VARCHAR(100),
    target_value DECIMAL(15,2),
    current_value DECIMAL(15,2),
    deadline TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    steps JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_goals_status ON agent_goals(status);
CREATE INDEX IF NOT EXISTS idx_agent_goals_priority ON agent_goals(priority DESC);
CREATE INDEX IF NOT EXISTS idx_agent_goals_deadline ON agent_goals(deadline) WHERE deadline IS NOT NULL;

-- ============================================
-- APPROVAL REQUESTS TABLE
-- Manages pending approvals for critical actions
-- ============================================
CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_id UUID NOT NULL,
    action_type VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('info', 'normal', 'critical', 'forbidden')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    approved_by VARCHAR(200),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_risk ON approval_requests(risk_level);
CREATE INDEX IF NOT EXISTS idx_approval_requests_expires ON approval_requests(expires_at);

-- ============================================
-- AUDIT LOG TABLE
-- Complete audit trail of all agent actions
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    action VARCHAR(500) NOT NULL,
    actor VARCHAR(200) NOT NULL,
    details JSONB DEFAULT '{}',
    result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'failure', 'blocked')),
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_result ON audit_log(result);

-- ============================================
-- AGENT CONFIGURATION TABLE
-- Stores agent settings and configuration
-- ============================================
CREATE TABLE IF NOT EXISTS agent_configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(200) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE,
    updated_by VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO agent_configuration (config_key, config_value, description) VALUES
('auto_execute_normal', 'true', 'Automatically execute normal risk actions'),
('auto_execute_info', 'true', 'Automatically execute info-only actions'),
('require_approval_for', '["critical", "forbidden"]', 'Risk levels that require explicit approval'),
('check_interval_minutes', '60', 'Interval between proactive checks'),
('max_daily_actions', '100', 'Maximum number of actions per day'),
('learning_enabled', 'true', 'Enable adaptive learning from feedback'),
('proactive_mode', 'true', 'Enable proactive monitoring and actions'),
('notification_channels', '["telegram", "email"]', 'Default notification channels')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================
-- UPDATE TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to all tables
CREATE TRIGGER update_agent_memory_updated_at BEFORE UPDATE ON agent_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_goals_updated_at BEFORE UPDATE ON agent_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approval_requests_updated_at BEFORE UPDATE ON approval_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_configuration_updated_at BEFORE UPDATE ON agent_configuration
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_configuration ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY admin_agent_memory ON agent_memory
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY admin_user_preferences ON user_preferences
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY admin_agent_goals ON agent_goals
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY admin_approval_requests ON approval_requests
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY admin_audit_log ON audit_log
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY admin_agent_configuration ON agent_configuration
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to clean expired memories
CREATE OR REPLACE FUNCTION clean_expired_memories()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM agent_memory 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get memory statistics
CREATE OR REPLACE FUNCTION get_memory_stats()
RETURNS TABLE (
    total_memories BIGINT,
    by_type JSONB,
    by_priority JSONB,
    recent_decisions BIGINT,
    active_goals BIGINT,
    user_preferences_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM agent_memory) as total_memories,
        (SELECT jsonb_object_agg(type, cnt) FROM (SELECT type, COUNT(*) as cnt FROM agent_memory GROUP BY type) t) as by_type,
        (SELECT jsonb_object_agg(priority, cnt) FROM (SELECT priority, COUNT(*) as cnt FROM agent_memory GROUP BY priority) t) as by_priority,
        (SELECT COUNT(*) FROM agent_memory WHERE type = 'decision' AND created_at > NOW() - INTERVAL '24 hours') as recent_decisions,
        (SELECT COUNT(*) FROM agent_goals WHERE status = 'active') as active_goals,
        (SELECT COUNT(*) FROM user_preferences) as user_preferences_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get daily report data
CREATE OR REPLACE FUNCTION get_daily_report_data()
RETURNS TABLE (
    date DATE,
    decisions BIGINT,
    suggestions BIGINT,
    outcomes BIGINT,
    approvals_pending BIGINT,
    approvals_approved BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE type = 'decision') as decisions,
        COUNT(*) FILTER (WHERE type = 'suggestion') as suggestions,
        COUNT(*) FILTER (WHERE type = 'outcome') as outcomes,
        (SELECT COUNT(*) FROM approval_requests WHERE status = 'pending' AND DATE(requested_at) = DATE(agent_memory.created_at)) as approvals_pending,
        (SELECT COUNT(*) FROM approval_requests WHERE status = 'approved' AND DATE(approved_at) = DATE(agent_memory.created_at)) as approvals_approved
    FROM agent_memory
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE agent_memory IS 'Stores all agent decisions, suggestions, and learning data';
COMMENT ON TABLE user_preferences IS 'Learned user preferences with confidence scores';
COMMENT ON TABLE agent_goals IS 'Long-term goals and their progress tracking';
COMMENT ON TABLE approval_requests IS 'Pending approvals for critical actions';
COMMENT ON TABLE audit_log IS 'Complete audit trail of all agent activities';
COMMENT ON TABLE agent_configuration IS 'Agent settings and configuration';
