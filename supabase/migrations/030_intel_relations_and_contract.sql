-- Migration 030: Intel relations hardening + compatibility columns
-- Goal: strengthen table relationships and keep backward compatibility.

-- 1) automation_rules compatibility (enabled <-> is_active) + tenant scope
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_rules' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE automation_rules
      ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_rules' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE automation_rules
      ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

UPDATE automation_rules
SET is_active = COALESCE(enabled, TRUE)
WHERE is_active IS NULL;

UPDATE automation_rules
SET enabled = COALESCE(is_active, TRUE)
WHERE enabled IS NULL;

CREATE OR REPLACE FUNCTION sync_automation_rule_flags()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active IS NULL AND NEW.enabled IS NULL THEN
    NEW.is_active = TRUE;
    NEW.enabled = TRUE;
  ELSIF NEW.is_active IS NULL THEN
    NEW.is_active = NEW.enabled;
  ELSIF NEW.enabled IS NULL THEN
    NEW.enabled = NEW.is_active;
  ELSE
    NEW.enabled = NEW.is_active;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sync_automation_rule_flags_trigger'
  ) THEN
    CREATE TRIGGER sync_automation_rule_flags_trigger
    BEFORE INSERT OR UPDATE ON automation_rules
    FOR EACH ROW
    EXECUTE FUNCTION sync_automation_rule_flags();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_automation_rules_company_active
  ON automation_rules(company_id, is_active);

-- 2) approval_requests relation fields for end-to-end traceability
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE approval_requests
      ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'actor_user_id'
  ) THEN
    ALTER TABLE approval_requests
      ADD COLUMN actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'approval_requests' AND column_name = 'command_log_id'
  ) THEN
    ALTER TABLE approval_requests
      ADD COLUMN command_log_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_approval_requests_company_status
  ON approval_requests(company_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_command_log
  ON approval_requests(command_log_id);

-- 3) audit_log relation fields for linked observability
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_log' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE audit_log
      ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_log' AND column_name = 'actor_user_id'
  ) THEN
    ALTER TABLE audit_log
      ADD COLUMN actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_log' AND column_name = 'approval_request_id'
  ) THEN
    ALTER TABLE audit_log
      ADD COLUMN approval_request_id UUID REFERENCES approval_requests(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_log' AND column_name = 'command_log_id'
  ) THEN
    ALTER TABLE audit_log
      ADD COLUMN command_log_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_log_company_timestamp
  ON audit_log(company_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_approval_request
  ON audit_log(approval_request_id);

-- 4) agent_memory relation fields for source linking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_memory' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE agent_memory
      ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_memory' AND column_name = 'actor_user_id'
  ) THEN
    ALTER TABLE agent_memory
      ADD COLUMN actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_memory' AND column_name = 'source_table'
  ) THEN
    ALTER TABLE agent_memory
      ADD COLUMN source_table VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_memory' AND column_name = 'source_id'
  ) THEN
    ALTER TABLE agent_memory
      ADD COLUMN source_id UUID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_memory_company_created
  ON agent_memory(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_source
  ON agent_memory(source_table, source_id);
