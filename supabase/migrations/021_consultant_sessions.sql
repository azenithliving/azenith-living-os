-- Migration: Create consultant_sessions table for Azenith AI Consultant
-- Created: 2026-04-15

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create consultant_sessions table
CREATE TABLE IF NOT EXISTS consultant_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT UNIQUE NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_consultant_sessions_session_id ON consultant_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_consultant_sessions_updated_at ON consultant_sessions(updated_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE consultant_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to create sessions
CREATE POLICY "Allow anonymous insert" ON consultant_sessions
    FOR INSERT TO anon
    WITH CHECK (true);

-- Allow anonymous users to read their own sessions by session_id
CREATE POLICY "Allow anonymous select by session_id" ON consultant_sessions
    FOR SELECT TO anon
    USING (true);

-- Allow anonymous users to update their own sessions
CREATE POLICY "Allow anonymous update" ON consultant_sessions
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_consultant_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS set_consultant_sessions_updated_at ON consultant_sessions;
CREATE TRIGGER set_consultant_sessions_updated_at
    BEFORE UPDATE ON consultant_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_consultant_sessions_updated_at();

-- Add comment for documentation
COMMENT ON TABLE consultant_sessions IS 'Stores conversation history for Azenith AI Consultant';
COMMENT ON COLUMN consultant_sessions.session_id IS 'Unique session identifier for the conversation';
COMMENT ON COLUMN consultant_sessions.messages IS 'JSON array of messages with role, content, and timestamp';
