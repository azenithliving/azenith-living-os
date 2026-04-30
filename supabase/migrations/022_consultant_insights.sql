-- Migration: Add insights column to consultant_sessions table
-- Created: 2026-04-15

-- Add insights column (jsonb) for storing AI-derived insights
ALTER TABLE consultant_sessions
ADD COLUMN IF NOT EXISTS insights JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN consultant_sessions.insights IS 'AI-derived insights from the conversation (e.g., room type, style preference, budget, urgency, etc.)';

-- Create index for jsonb queries (if needed in the future)
CREATE INDEX IF NOT EXISTS idx_consultant_sessions_insights ON consultant_sessions USING GIN (insights);
