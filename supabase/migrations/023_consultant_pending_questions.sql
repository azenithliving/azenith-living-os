-- Migration: Create consultant_pending_questions table
-- Stores questions that the consultant couldn't answer

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create consultant_pending_questions table
CREATE TABLE IF NOT EXISTS consultant_pending_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    session_id TEXT,
    user_email TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    answered_at TIMESTAMP WITH TIME ZONE
);

-- Add comments for documentation
COMMENT ON TABLE consultant_pending_questions IS 'Stores questions that the consultant AI could not answer and needs admin attention';
COMMENT ON COLUMN consultant_pending_questions.question IS 'The question asked by the visitor';
COMMENT ON COLUMN consultant_pending_questions.session_id IS 'The consultant session ID';
COMMENT ON COLUMN consultant_pending_questions.status IS 'Status: pending or answered';

-- Create indexes for faster retrieval
CREATE INDEX IF NOT EXISTS idx_consultant_pending_questions_status 
    ON consultant_pending_questions(status);
CREATE INDEX IF NOT EXISTS idx_consultant_pending_questions_created_at 
    ON consultant_pending_questions(created_at);

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON consultant_pending_questions TO authenticated;
