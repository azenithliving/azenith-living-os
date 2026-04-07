-- SQL Script: Create newsletter_subscribers table for Elite Access system
-- Run this in your Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the newsletter_subscribers table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    -- Constraint for status values
    CONSTRAINT valid_status CHECK (status IN ('active', 'unsubscribed', 'bounced', 'complained'))
);

-- Create index for email lookups (used for duplicate checking)
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email 
    ON newsletter_subscribers(email);

-- Create index for status filtering (useful for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status 
    ON newsletter_subscribers(status);

-- Create index for created_at (useful for sorting by subscription date)
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created_at 
    ON newsletter_subscribers(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE newsletter_subscribers IS 'Stores newsletter subscriber data for the Elite Access program';
COMMENT ON COLUMN newsletter_subscribers.metadata IS 'JSON blob for storing user behavior context, source, utm params, etc.';

-- Enable Row Level Security (RLS)
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Create policy for admin read access (service role bypasses RLS)
CREATE POLICY "Allow service role full access" 
    ON newsletter_subscribers 
    FOR ALL 
    TO authenticated, service_role 
    USING (true) 
    WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_newsletter_subscribers_updated_at 
    BEFORE UPDATE ON newsletter_subscribers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Verify table creation
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'newsletter_subscribers';
