-- Migration: Create immutable_command_log table for Mastermind self-evolution
-- This table logs all commands executed by Mastermind for analysis and improvement

CREATE TABLE IF NOT EXISTS immutable_command_log (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  command_text TEXT NOT NULL,
  signature TEXT,
  executor_ip TEXT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed')),
  result_summary TEXT,
  parameters JSONB
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_immutable_command_log_user_id ON immutable_command_log(user_id);
CREATE INDEX IF NOT EXISTS idx_immutable_command_log_status ON immutable_command_log(status);
CREATE INDEX IF NOT EXISTS idx_immutable_command_log_executed_at ON immutable_command_log(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_immutable_command_log_command_text ON immutable_command_log(command_text);

-- Enable RLS for security
ALTER TABLE immutable_command_log ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view their own logs
CREATE POLICY "Users can view their own command logs"
  ON immutable_command_log
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy: Allow service role to insert/update all logs
CREATE POLICY "Service role can manage all logs"
  ON immutable_command_log
  FOR ALL
  USING (true)
  WITH CHECK (true);
