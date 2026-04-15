-- Migration: Create consultant_faq table
-- Stores FAQ entries created from answered pending questions

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create consultant_faq table
CREATE TABLE IF NOT EXISTS consultant_faq (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    original_pending_question_id UUID REFERENCES consultant_pending_questions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE consultant_faq IS 'Stores FAQ entries with questions and answers for the consultant AI';
COMMENT ON COLUMN consultant_faq.question IS 'The question';
COMMENT ON COLUMN consultant_faq.answer IS 'The answer provided by admin';
COMMENT ON COLUMN consultant_faq.original_pending_question_id IS 'Reference to the original pending question if applicable';

-- Create indexes for faster retrieval
CREATE INDEX IF NOT EXISTS idx_consultant_faq_created_at 
    ON consultant_faq(created_at);

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON consultant_faq TO authenticated;
