-- Fix subscriptions table: Add ON DELETE CASCADE for company_id reference
-- This prevents orphaned subscription records when a company is deleted

-- First, drop the existing foreign key constraint if it exists
ALTER TABLE IF EXISTS subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_company_id_fkey;

-- Add the foreign key constraint with ON DELETE CASCADE
ALTER TABLE IF EXISTS subscriptions
  ADD CONSTRAINT subscriptions_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE CASCADE;

-- Also ensure api_keys table has proper cleanup triggers
-- Create function to cleanup old cooldowns
CREATE OR REPLACE FUNCTION cleanup_stale_cooldowns()
RETURNS void AS $$
BEGIN
  UPDATE api_keys
  SET cooldown_until = NULL
  WHERE cooldown_until < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
