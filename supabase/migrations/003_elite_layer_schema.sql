-- ELITE LAYER DATABASE SCHEMA
-- Parallel system tables - DO NOT modify existing tables
-- Classification: ISOLATE - Elite-specific authentication and access control

-- Enable pgcrypto for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ELITE CLIENT ACCESS TABLE
-- Stores elite client access records linked to requests (read-only FK)
-- Classification: ISOLATE - Elite-specific access management
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  access_status TEXT NOT NULL DEFAULT 'pending' CHECK (access_status IN ('pending', 'active', 'suspended', 'expired')),
  expires_at TIMESTAMPTZ,
  subscription_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_access_phone ON public.client_access(phone);
CREATE INDEX IF NOT EXISTS idx_client_access_status ON public.client_access(access_status);
CREATE INDEX IF NOT EXISTS idx_client_access_request ON public.client_access(request_id);
CREATE INDEX IF NOT EXISTS idx_client_access_expires ON public.client_access(expires_at);

-- ============================================
-- LOGIN TOKENS TABLE
-- Passwordless authentication via WhatsApp
-- Classification: ISOLATE - Elite-specific auth mechanism
-- ============================================
CREATE TABLE IF NOT EXISTS public.login_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  client_access_id UUID REFERENCES public.client_access(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for token validation performance
CREATE INDEX IF NOT EXISTS idx_login_tokens_token ON public.login_tokens(token);
CREATE INDEX IF NOT EXISTS idx_login_tokens_phone ON public.login_tokens(phone);
CREATE INDEX IF NOT EXISTS idx_login_tokens_expires ON public.login_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_tokens_unused ON public.login_tokens(used, expires_at) WHERE used = false;

-- ============================================
-- ELITE SESSIONS TABLE
-- Server-side session tracking for elite clients
-- Classification: ISOLATE - Elite-specific session management
-- ============================================
CREATE TABLE IF NOT EXISTS public.elite_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_access_id UUID NOT NULL REFERENCES public.client_access(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_elite_sessions_token ON public.elite_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_elite_sessions_client ON public.elite_sessions(client_access_id);
CREATE INDEX IF NOT EXISTS idx_elite_sessions_expires ON public.elite_sessions(expires_at);

-- ============================================
-- ELITE ACTIVITY LOG
-- Audit trail for elite client actions
-- Classification: ISOLATE - Elite-specific analytics
-- ============================================
CREATE TABLE IF NOT EXISTS public.elite_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_access_id UUID NOT NULL REFERENCES public.client_access(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_elite_activity_client ON public.elite_activity_log(client_access_id);
CREATE INDEX IF NOT EXISTS idx_elite_activity_created ON public.elite_activity_log(created_at);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
DROP TRIGGER IF EXISTS client_access_set_updated_at ON public.client_access;
CREATE TRIGGER client_access_set_updated_at
  BEFORE UPDATE ON public.client_access
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE public.client_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elite_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elite_activity_log ENABLE ROW LEVEL SECURITY;

-- Client Access policies
DROP POLICY IF EXISTS client_access_isolation ON public.client_access;
CREATE POLICY client_access_isolation ON public.client_access
  FOR ALL
  USING (true)  -- Allow reads for auth purposes
  WITH CHECK (true);

-- Login Tokens policies
DROP POLICY IF EXISTS login_tokens_isolation ON public.login_tokens;
CREATE POLICY login_tokens_isolation ON public.login_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Elite Sessions policies
DROP POLICY IF EXISTS elite_sessions_isolation ON public.elite_sessions;
CREATE POLICY elite_sessions_isolation ON public.elite_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Elite Activity Log policies
DROP POLICY IF EXISTS elite_activity_log_isolation ON public.elite_activity_log;
CREATE POLICY elite_activity_log_isolation ON public.elite_activity_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Validate and consume login token
CREATE OR REPLACE FUNCTION public.validate_login_token(p_token TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  phone TEXT,
  client_access_id UUID,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- Find the token
  SELECT lt.*, ca.id as ca_id, ca.access_status
  INTO v_record
  FROM public.login_tokens lt
  LEFT JOIN public.client_access ca ON ca.phone = lt.phone
  WHERE lt.token = p_token;

  -- Check if token exists
  IF v_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, 'Invalid token'::TEXT;
    RETURN;
  END IF;

  -- Check if already used
  IF v_record.used THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, 'Token already used'::TEXT;
    RETURN;
  END IF;

  -- Check if expired
  IF v_record.expires_at < timezone('utc', now()) THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, 'Token expired'::TEXT;
    RETURN;
  END IF;

  -- Mark as used
  UPDATE public.login_tokens
  SET used = true, used_at = timezone('utc', now())
  WHERE token = p_token;

  -- Return success
  RETURN QUERY SELECT true, v_record.phone, v_record.ca_id, 'Token valid'::TEXT;
END;
$$;

-- Create or get client access record
CREATE OR REPLACE FUNCTION public.get_or_create_client_access(p_phone TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Try to find existing
  SELECT id INTO v_id
  FROM public.client_access
  WHERE phone = p_phone
  ORDER BY created_at DESC
  LIMIT 1;

  -- Create if not exists
  IF v_id IS NULL THEN
    INSERT INTO public.client_access (phone, access_status)
    VALUES (p_phone, 'active')
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- Cleanup expired tokens (can be run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.login_tokens
  WHERE expires_at < timezone('utc', now()) - interval '7 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
