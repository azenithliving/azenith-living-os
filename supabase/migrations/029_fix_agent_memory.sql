-- Migration 029: Fix Agent Memory Schema
-- Adds missing columns if they don't exist

-- Fix agent_memory table - add missing columns
DO $$
BEGIN
    -- Add type column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_memory' AND column_name = 'type') THEN
        ALTER TABLE agent_memory ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'interaction';
    END IF;

    -- Add category column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_memory' AND column_name = 'category') THEN
        ALTER TABLE agent_memory ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'general';
    END IF;

    -- Add content column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_memory' AND column_name = 'content') THEN
        ALTER TABLE agent_memory ADD COLUMN content TEXT NOT NULL DEFAULT '';
    END IF;

    -- Add context column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_memory' AND column_name = 'context') THEN
        ALTER TABLE agent_memory ADD COLUMN context JSONB DEFAULT '{}';
    END IF;

    -- Add priority column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_memory' AND column_name = 'priority') THEN
        ALTER TABLE agent_memory ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'normal';
    END IF;

    -- Add outcome column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_memory' AND column_name = 'outcome') THEN
        ALTER TABLE agent_memory ADD COLUMN outcome VARCHAR(20);
    END IF;

    -- Add user_feedback column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_memory' AND column_name = 'user_feedback') THEN
        ALTER TABLE agent_memory ADD COLUMN user_feedback VARCHAR(20);
    END IF;

    -- Add expires_at column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_memory' AND column_name = 'expires_at') THEN
        ALTER TABLE agent_memory ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add updated_at column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_memory' AND column_name = 'updated_at') THEN
        ALTER TABLE agent_memory ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_category ON agent_memory(category);
CREATE INDEX IF NOT EXISTS idx_agent_memory_priority ON agent_memory(priority);
CREATE INDEX IF NOT EXISTS idx_agent_memory_created_at ON agent_memory(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_outcome ON agent_memory(outcome);
CREATE INDEX IF NOT EXISTS idx_agent_memory_expires ON agent_memory(expires_at) WHERE expires_at IS NOT NULL;

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_agent_memory_content_search ON agent_memory USING gin(to_tsvector('english', content));

-- Create other tables from 028 if they don't exist
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

-- Update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_memory_updated_at') THEN
        CREATE TRIGGER update_agent_memory_updated_at BEFORE UPDATE ON agent_memory
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_preferences_updated_at') THEN
        CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_goals_updated_at') THEN
        CREATE TRIGGER update_agent_goals_updated_at BEFORE UPDATE ON agent_goals
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_approval_requests_updated_at') THEN
        CREATE TRIGGER update_approval_requests_updated_at BEFORE UPDATE ON approval_requests
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_configuration_updated_at') THEN
        CREATE TRIGGER update_agent_configuration_updated_at BEFORE UPDATE ON agent_configuration
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Enable RLS
ALTER TABLE IF EXISTS agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_configuration ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
    -- Check and create policies for agent_memory
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_agent_memory') THEN
        CREATE POLICY admin_agent_memory ON agent_memory
            FOR ALL TO authenticated
            USING (auth.jwt() ->> 'role' = 'admin');
    END IF;

    -- Check and create policies for user_preferences
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_user_preferences') THEN
        CREATE POLICY admin_user_preferences ON user_preferences
            FOR ALL TO authenticated
            USING (auth.jwt() ->> 'role' = 'admin');
    END IF;

    -- Check and create policies for agent_goals
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_agent_goals') THEN
        CREATE POLICY admin_agent_goals ON agent_goals
            FOR ALL TO authenticated
            USING (auth.jwt() ->> 'role' = 'admin');
    END IF;

    -- Check and create policies for approval_requests
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_approval_requests') THEN
        CREATE POLICY admin_approval_requests ON approval_requests
            FOR ALL TO authenticated
            USING (auth.jwt() ->> 'role' = 'admin');
    END IF;

    -- Check and create policies for audit_log
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_audit_log') THEN
        CREATE POLICY admin_audit_log ON audit_log
            FOR ALL TO authenticated
            USING (auth.jwt() ->> 'role' = 'admin');
    END IF;

    -- Check and create policies for agent_configuration
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_agent_configuration') THEN
        CREATE POLICY admin_agent_configuration ON agent_configuration
            FOR ALL TO authenticated
            USING (auth.jwt() ->> 'role' = 'admin');
    END IF;
END $$;
