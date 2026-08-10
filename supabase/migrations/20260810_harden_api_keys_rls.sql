-- Migration 20260810: Harden api_keys table with RLS
-- Security fix: api_keys table was fully exposed to anon role (any visitor could read all API keys)
-- Now: RLS enabled, anon/authenticated revoked, only service_role (server-side) can access.

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing permissive policies
DROP POLICY IF EXISTS "api_keys_read_all" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_write_all" ON public.api_keys;
DROP POLICY IF EXISTS "enable_all_for_anon" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_select_policy" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_insert_policy" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_update_policy" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_delete_policy" ON public.api_keys;

-- No public access: anon and authenticated roles get zero rows
REVOKE ALL ON public.api_keys FROM anon, authenticated;

-- Service role bypasses RLS (BYPASSRLS) - used by server-side admin client
GRANT ALL ON public.api_keys TO service_role;
