-- P6-M6: the gate's own memory was missing.
--
-- `app/api/admin/verify-2fa` writes two records on every attempt: a row in
-- `sovereign_sessions` when the second factor passes, and a row in
-- `failed_login_attempts` when it does not. Neither table exists in this
-- database — `016_sovereign_security.sql` created them, and that file never
-- landed here (its `user_2fa` and `immutable_command_log` did arrive by another
-- path, which is why the gap was invisible: the two inserts fail, nothing checks
-- their error, and the security log silently records nothing at all).
--
-- Same definitions as 016, idempotent, so applying 016 later changes nothing.

CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT,
    ip_address TEXT NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT now(),
    failure_reason TEXT,
    user_agent TEXT
);

--SPLIT--

CREATE TABLE IF NOT EXISTS sovereign_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    is_2fa_verified BOOLEAN DEFAULT false,
    is_signature_verified BOOLEAN DEFAULT false,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ DEFAULT now()
);

--SPLIT--

ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

--SPLIT--

ALTER TABLE sovereign_sessions ENABLE ROW LEVEL SECURITY;

--SPLIT--

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage failed attempts') THEN
    CREATE POLICY "Service role can manage failed attempts"
      ON failed_login_attempts FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

--SPLIT--

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage all sessions') THEN
    CREATE POLICY "Service role can manage all sessions"
      ON sovereign_sessions FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

--SPLIT--

CREATE INDEX IF NOT EXISTS idx_failed_login_email_time
  ON failed_login_attempts(email, attempted_at DESC);

--SPLIT--

CREATE INDEX IF NOT EXISTS idx_sovereign_sessions_user
  ON sovereign_sessions(user_id, expires_at DESC);

--SPLIT--

-- PostgREST caches the schema: without this the new tables stay invisible to the
-- API even though the database has them.
NOTIFY pgrst, 'reload schema';
