-- Migration: General Suggestions Table for Omnipotent Agent
-- Description: Flexible table for storing AI-generated suggestions without predefined types

-- Create the main suggestions table
CREATE TABLE IF NOT EXISTS general_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    proposed_plan JSONB NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    triggered_by TEXT DEFAULT 'general_agent',
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    executed_at TIMESTAMPTZ,
    execution_result JSONB,
    rejection_reason TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    category TEXT -- Flexible categorization, not enforced
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_general_suggestions_status ON general_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_general_suggestions_created_at ON general_suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_general_suggestions_priority ON general_suggestions(priority);

-- Create monitoring logs table for tracking autonomous checks
CREATE TABLE IF NOT EXISTS monitoring_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT now(),
    findings_count INTEGER DEFAULT 0,
    suggestions_generated INTEGER DEFAULT 0,
    findings JSONB DEFAULT '[]'::jsonb,
    execution_time_ms INTEGER,
    agent_version TEXT DEFAULT '1.0'
);

CREATE INDEX IF NOT EXISTS idx_monitoring_logs_timestamp ON monitoring_logs(timestamp DESC);

-- Create API logs table for tracking endpoint usage (optional analytics)
CREATE TABLE IF NOT EXISTS api_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL,
    method TEXT DEFAULT 'GET',
    count INTEGER DEFAULT 0,
    last_called TIMESTAMPTZ,
    average_response_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_logs(endpoint);

-- Enable Row Level Security
ALTER TABLE general_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for general_suggestions
CREATE POLICY "Admins can view all suggestions"
    ON general_suggestions FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (users.role = 'admin' OR users.role = 'superadmin')
    ));

CREATE POLICY "Admins can update suggestions"
    ON general_suggestions FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (users.role = 'admin' OR users.role = 'superadmin')
    ));

CREATE POLICY "Admins can delete suggestions"
    ON general_suggestions FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (users.role = 'admin' OR users.role = 'superadmin')
    ));

CREATE POLICY "System can insert suggestions"
    ON general_suggestions FOR INSERT
    WITH CHECK (true); -- Service role key handles this

-- Create policies for monitoring_logs (admin only)
CREATE POLICY "Admins can view monitoring logs"
    ON monitoring_logs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (users.role = 'admin' OR users.role = 'superadmin')
    ));

-- Create policies for api_logs (admin only)
CREATE POLICY "Admins can view api logs"
    ON api_logs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (users.role = 'admin' OR users.role = 'superadmin')
    ));

-- Add helpful comments
COMMENT ON TABLE general_suggestions IS 'Stores AI-generated suggestions from the Omnipotent Agent for admin review';
COMMENT ON COLUMN general_suggestions.proposed_plan IS 'JSON plan with execution steps from LLM';
COMMENT ON COLUMN general_suggestions.status IS 'pending, approved, rejected, or executed';
COMMENT ON COLUMN general_suggestions.triggered_by IS 'Identifier of the agent/system that generated this suggestion';
