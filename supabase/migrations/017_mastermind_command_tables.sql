-- Migration: Mastermind Command Tables (Phase 3)
-- Created: 2026-04-12
-- Purpose: Support command execution, logging, and backup functionality

-- ============================================
-- 1. Update api_keys table - Add user_id column
-- ============================================
DO $$ 
BEGIN
  -- Add user_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'api_keys' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE api_keys 
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- Create index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
  END IF;
END $$;

-- ============================================
-- 2. Create immutable_command_log table
-- ============================================
CREATE TABLE IF NOT EXISTS immutable_command_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  command_text TEXT NOT NULL,
  command_hash TEXT GENERATED ALWAYS AS (encode(sha256(command_text::bytea), 'hex')) STORED,
  signature TEXT,
  executor_ip TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed', 'rejected')),
  result_summary TEXT,
  parameters JSONB,
  execution_time_ms INTEGER,
  
  -- Security: Prevent updates (immutable)
  CONSTRAINT no_update_allowed CHECK (false) NO INHERIT
);

-- Enable RLS
ALTER TABLE immutable_command_log ENABLE ROW LEVEL SECURITY;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_command_log_user_id ON immutable_command_log(user_id);
CREATE INDEX IF NOT EXISTS idx_command_log_executed_at ON immutable_command_log(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_log_status ON immutable_command_log(status);

-- Policies
CREATE POLICY "Users can view own commands" ON immutable_command_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert commands" ON immutable_command_log
  FOR INSERT WITH CHECK (true);

-- Prevent updates (immutable log)
CREATE POLICY "Prevent updates on command log" ON immutable_command_log
  FOR UPDATE USING (false);

-- ============================================
-- 3. Create backups table
-- ============================================
CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  backup_data JSONB NOT NULL,
  size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  backup_type TEXT DEFAULT 'manual',
  tables_included TEXT[],
  error_message TEXT
);

-- Enable RLS
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backups_user_id ON backups(user_id);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);

-- Policies
CREATE POLICY "Users can view own backups" ON backups
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create backups" ON backups
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- 4. Create rate_limits table (for rate_limit command)
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id SERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  limit_per_hour INTEGER NOT NULL DEFAULT 1000,
  rate_window TEXT DEFAULT '1h',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage rate limits" ON rate_limits
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_2fa WHERE user_id = auth.uid() AND is_enabled = true
  ));

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE immutable_command_log IS 'Tamper-proof audit log of all mastermind commands';
COMMENT ON TABLE backups IS 'Database backup metadata for admin operations';
COMMENT ON TABLE rate_limits IS 'Rate limiting configuration for API endpoints';
