-- Week 0: Database Reconciliation Migration
-- Fixes drift between existing migrations and code assumptions
-- Run this BEFORE any new feature migrations

-- ===========================================
-- 1. Fix users table - add auth_user_id FK
-- ===========================================

-- Check if auth_user_id column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN auth_user_id UUID;
    
    -- Add FK constraint (commented out if auth.users doesn't exist in all cases)
    -- ALTER TABLE public.users 
    -- ADD CONSTRAINT fk_users_auth 
    -- FOREIGN KEY (auth_user_id) 
    -- REFERENCES auth.users(id) 
    -- ON DELETE SET NULL;
    
    -- Create index for performance
    CREATE INDEX idx_users_auth_user_id ON public.users(auth_user_id);
    
    RAISE NOTICE 'Added auth_user_id column to users table';
  ELSE
    RAISE NOTICE 'auth_user_id column already exists';
  END IF;
END $$;

-- ===========================================
-- 2. Fix requests table - add manufacturing columns
-- ===========================================

DO $$
BEGIN
  -- Add manufacturing_stage column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'requests' 
    AND column_name = 'manufacturing_stage'
  ) THEN
    ALTER TABLE public.requests ADD COLUMN manufacturing_stage VARCHAR(50);
    CREATE INDEX idx_requests_manufacturing_stage ON public.requests(manufacturing_stage);
    RAISE NOTICE 'Added manufacturing_stage column';
  END IF;

  -- Add deposit_amount column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'requests' 
    AND column_name = 'deposit_amount'
  ) THEN
    ALTER TABLE public.requests ADD COLUMN deposit_amount DECIMAL(10,2);
    RAISE NOTICE 'Added deposit_amount column';
  END IF;

  -- Add deposit_paid column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'requests' 
    AND column_name = 'deposit_paid'
  ) THEN
    ALTER TABLE public.requests ADD COLUMN deposit_paid BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added deposit_paid column';
  END IF;

  -- Add final_payment_paid column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'requests' 
    AND column_name = 'final_payment_paid'
  ) THEN
    ALTER TABLE public.requests ADD COLUMN final_payment_paid BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added final_payment_paid column';
  END IF;
END $$;

-- ===========================================
-- 3. Unify site_settings schema
-- ===========================================

DO $$
BEGIN
  -- Add current_revision_id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'site_settings' 
    AND column_name = 'current_revision_id'
  ) THEN
    ALTER TABLE public.site_settings ADD COLUMN current_revision_id UUID;
    RAISE NOTICE 'Added current_revision_id to site_settings';
  END IF;

  -- Add schema_version if not exists (for tracking)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'site_settings' 
    AND column_name = 'schema_version'
  ) THEN
    ALTER TABLE public.site_settings ADD COLUMN schema_version VARCHAR(10) DEFAULT '1.0';
    RAISE NOTICE 'Added schema_version to site_settings';
  END IF;
END $$;

-- Update schema version marker
UPDATE public.site_settings 
SET schema_version = '2.0', 
    current_revision_id = gen_random_uuid()
WHERE key = 'schema_version' 
   OR key = 'database_version';

-- Insert schema version marker if not exists
INSERT INTO public.site_settings (key, value, schema_version)
SELECT 'database_reconciliation', '20260423', '2.0'
WHERE NOT EXISTS (
  SELECT 1 FROM public.site_settings WHERE key = 'database_reconciliation'
);

-- ===========================================
-- 4. Consolidate audit tables
-- ===========================================

-- Ensure audit_log is the canonical table
-- (Don't drop old tables, just ensure audit_log exists and is up to date)

DO $$
BEGIN
  -- Add company_id to audit_log if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_log' 
    AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.audit_log ADD COLUMN company_id UUID;
    CREATE INDEX idx_audit_log_company ON public.audit_log(company_id);
    RAISE NOTICE 'Added company_id to audit_log';
  END IF;

  -- Ensure user_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_log' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.audit_log ADD COLUMN user_id UUID;
    RAISE NOTICE 'Added user_id to audit_log';
  END IF;
END $$;

-- ===========================================
-- 5. Fix team_roles and team_members (revive if they exist)
-- ===========================================

DO $$
BEGIN
  -- Check if team_roles table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'team_roles'
  ) THEN
    -- Add description column if not exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'team_roles' 
      AND column_name = 'description'
    ) THEN
      ALTER TABLE public.team_roles ADD COLUMN description TEXT;
      RAISE NOTICE 'Added description to team_roles';
    END IF;
    
    RAISE NOTICE 'team_roles table verified';
  ELSE
    RAISE NOTICE 'team_roles table does not exist - will be created in agent tables migration';
  END IF;

  -- Check if team_members table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'team_members'
  ) THEN
    -- Add auth_user_id if not exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'team_members' 
      AND column_name = 'auth_user_id'
    ) THEN
      ALTER TABLE public.team_members ADD COLUMN auth_user_id UUID;
      RAISE NOTICE 'Added auth_user_id to team_members';
    END IF;
    
    RAISE NOTICE 'team_members table verified';
  ELSE
    RAISE NOTICE 'team_members table does not exist - will be created in agent tables migration';
  END IF;
END $$;

-- ===========================================
-- 6. Add indexes for performance
-- ===========================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_company ON public.users(company_id);

-- Requests indexes
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_user ON public.requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_company ON public.requests(company_id);

-- Approval requests indexes
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_company ON public.approval_requests(company_id);

-- Agent tables indexes (if they exist)
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON public.agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_events_company ON public.agent_events(company_id);

-- ===========================================
-- 7. Verification: Check for data drift
-- ===========================================

-- Create a function to verify the reconciliation
CREATE OR REPLACE FUNCTION verify_reconciliation()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Check 1: users.auth_user_id exists
  RETURN QUERY
  SELECT 
    'users.auth_user_id column'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_user_id'
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Column for linking to auth.users'::TEXT;

  -- Check 2: requests manufacturing columns
  RETURN QUERY
  SELECT 
    'requests.manufacturing columns'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'manufacturing_stage'
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Columns for manufacturing workflow'::TEXT;

  -- Check 3: site_settings schema_version
  RETURN QUERY
  SELECT 
    'site_settings.schema_version'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'schema_version'
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Schema version tracking'::TEXT;

  -- Check 4: audit_log canonical
  RETURN QUERY
  SELECT 
    'audit_log.company_id'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'company_id'
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Audit log company tracking'::TEXT;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Run verification
SELECT * FROM verify_reconciliation();

-- ===========================================
-- 8. Mark reconciliation complete
-- ===========================================

INSERT INTO public.site_settings (key, value, schema_version, created_at, updated_at)
VALUES (
  'reconciliation_status', 
  'completed', 
  '2.0',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = 'completed',
  schema_version = '2.0',
  updated_at = NOW();

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Database Reconciliation Complete';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Next: Run manufacturing and agent migrations';
END $$;
