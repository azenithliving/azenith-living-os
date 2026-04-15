-- Migration: Create consultant_learnings table for Admin Learning Mode
-- This table stores instructions/learning from admin to train the consultant

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create consultant_learnings table
CREATE TABLE IF NOT EXISTS consultant_learnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instruction TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE consultant_learnings IS 'Stores learning instructions from admin to train the consultant AI';
COMMENT ON COLUMN consultant_learnings.instruction IS 'The instruction/learning text provided by admin';

-- Create index for faster retrieval
CREATE INDEX IF NOT EXISTS idx_consultant_learnings_created_at 
    ON consultant_learnings(created_at);

-- Grant access to authenticated users (for admin operations)
GRANT SELECT, INSERT, DELETE ON consultant_learnings TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE consultant_learnings_id_seq TO authenticated;
