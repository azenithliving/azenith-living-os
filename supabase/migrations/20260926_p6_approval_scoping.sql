-- P6-M6: the approval queue was unreadable, and this is why.
--
-- `supabase/migrations/030_intel_relations_and_contract.sql` describes the
-- company scoping of `approval_requests`, and the API has been querying on it
-- ever since:
--
--   GET  /api/admin/agents/approval-queue → .or(`company_id.eq.<id>,company_id.is.null`)
--   lib/admin-sovereign-mind.ts           → inserts company_id + actor_user_id
--
-- The live database says 42703 for `company_id`, `actor_user_id` and
-- `command_log_id`: that block of 030 never landed here. So every read of the
-- approval queue answered an error, and the decision surface behind the
-- Telegram morning link could not open a proposal at all.
--
-- Additive and idempotent — the same guard shape 030 used, so re-running it, or
-- running 030 later, is a no-op.
--
-- Applied with: node scripts/apply-p6-migration.mjs \
--   supabase/migrations/20260926_p6_approval_scoping.sql --apply
-- then verified by reading the columns back from the database (see the ledger).

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

--SPLIT--

CREATE INDEX IF NOT EXISTS idx_approval_requests_company_status
  ON approval_requests(company_id, status);

--SPLIT--

-- PostgREST caches the schema: without this the new columns stay invisible to
-- the API even though the database has them, which is how this file reads after
-- a successful run — applied, and still 42703.
NOTIFY pgrst, 'reload schema';
