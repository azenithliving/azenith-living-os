-- =====================================================
-- EMERGENCY SCHEMA SETUP + SEED DATA FOR AZENITH LIVING
-- Run this in Supabase SQL Editor (supabase.com/dashboard)
-- =====================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. CREATE UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- =====================================================
-- 2. CREATE COMPANIES TABLE (TENANTS)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  logo TEXT,
  primary_color TEXT,
  whatsapp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_companies_domain ON public.companies(domain);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS companies_set_updated_at ON public.companies;
CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 3. SEED DEFAULT AZENITH LIVING TENANT
-- =====================================================
-- Delete existing if present (safe re-run)
DELETE FROM public.companies WHERE domain = 'localhost' OR domain = 'azenithliving.com';

-- Insert the master tenant
INSERT INTO public.companies (id, name, domain, primary_color, whatsapp)
VALUES (
  '00000000-0000-0000-0000-000000000001', -- Fixed UUID for easy reference
  'Azenith Living',
  'localhost',
  '#C5A059',
  '201090819584'
)
ON CONFLICT (domain) DO NOTHING;

-- Also add production domain if different
INSERT INTO public.companies (name, domain, primary_color, whatsapp)
VALUES (
  'Azenith Living',
  'azenithliving.com',
  '#C5A059',
  '201090819584'
)
ON CONFLICT (domain) DO NOTHING;

-- =====================================================
-- 4. CREATE USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  intent TEXT NOT NULL DEFAULT 'browsing',
  last_page TEXT,
  room_type TEXT,
  budget TEXT,
  style TEXT,
  service_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_users_company_id ON public.users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_company_intent_score ON public.users(company_id, intent, score);

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 5. CREATE EVENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  value TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_events_company_created_at ON public.events(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_company_type_created_at ON public.events(company_id, type, created_at);

-- =====================================================
-- 6. CREATE REQUESTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  room_type TEXT,
  budget TEXT,
  style TEXT,
  service_type TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  price NUMERIC(12,2),
  paid BOOLEAN NOT NULL DEFAULT false,
  quote_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_requests_company_status_created_at ON public.requests(company_id, status, created_at);

DROP TRIGGER IF EXISTS requests_set_updated_at ON public.requests;
CREATE TRIGGER requests_set_updated_at BEFORE UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 7. CREATE PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_payments_company_created_at ON public.payments(company_id, created_at);

-- =====================================================
-- 8. CREATE BOOKINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_bookings_company_slot_start ON public.bookings(company_id, slot_start);

DROP TRIGGER IF EXISTS bookings_set_updated_at ON public.bookings;
CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 9. CREATE AUTOMATION RULES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

DROP TRIGGER IF EXISTS automation_rules_set_updated_at ON public.automation_rules;
CREATE TRIGGER automation_rules_set_updated_at BEFORE UPDATE ON public.automation_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 10. CREATE NEWSLETTER SUBSCRIBERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status ON public.newsletter_subscribers(status);

DROP TRIGGER IF EXISTS newsletter_subscribers_set_updated_at ON public.newsletter_subscribers;
CREATE TRIGGER newsletter_subscribers_set_updated_at BEFORE UPDATE ON public.newsletter_subscribers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 11. CREATE SITE_CONFIG TABLE (FOR CMS)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.site_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_config_tenant_section_key ON public.site_config(tenant_id, section, key);

DROP TRIGGER IF EXISTS site_config_set_updated_at ON public.site_config;
CREATE TRIGGER site_config_set_updated_at BEFORE UPDATE ON public.site_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default CMS config
INSERT INTO public.site_config (tenant_id, section, key, value)
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  'hero',
  'content',
  '{"title": "ابدأ رحلة التصميم الذكي", "subtitle": "احصل على تصميم داخلي احترافي خلال أيام، ليس أسابيع"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.site_config 
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND section = 'hero' AND key = 'content'
);

-- =====================================================
-- 12. ENABLE ROW LEVEL SECURITY (RLS) - SAFE MODE
-- =====================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 13. CREATE SAFE RLS POLICIES (Allow All for Now - Restrict Later)
-- =====================================================
-- Companies: Allow all operations for authenticated users
DROP POLICY IF EXISTS companies_allow_all ON public.companies;
CREATE POLICY companies_allow_all ON public.companies
FOR ALL USING (true) WITH CHECK (true);

-- Users: Allow all
DROP POLICY IF EXISTS users_allow_all ON public.users;
CREATE POLICY users_allow_all ON public.users
FOR ALL USING (true) WITH CHECK (true);

-- Events: Allow all
DROP POLICY IF EXISTS events_allow_all ON public.events;
CREATE POLICY events_allow_all ON public.events
FOR ALL USING (true) WITH CHECK (true);

-- Requests: Allow all
DROP POLICY IF EXISTS requests_allow_all ON public.requests;
CREATE POLICY requests_allow_all ON public.requests
FOR ALL USING (true) WITH CHECK (true);

-- Payments: Allow all
DROP POLICY IF EXISTS payments_allow_all ON public.payments;
CREATE POLICY payments_allow_all ON public.payments
FOR ALL USING (true) WITH CHECK (true);

-- Bookings: Allow all
DROP POLICY IF EXISTS bookings_allow_all ON public.bookings;
CREATE POLICY bookings_allow_all ON public.bookings
FOR ALL USING (true) WITH CHECK (true);

-- Automation Rules: Allow all
DROP POLICY IF EXISTS automation_rules_allow_all ON public.automation_rules;
CREATE POLICY automation_rules_allow_all ON public.automation_rules
FOR ALL USING (true) WITH CHECK (true);

-- Newsletter Subscribers: Allow all
DROP POLICY IF EXISTS newsletter_subscribers_allow_all ON public.newsletter_subscribers;
CREATE POLICY newsletter_subscribers_allow_all ON public.newsletter_subscribers
FOR ALL USING (true) WITH CHECK (true);

-- Site Config: Allow all (for public read access via CMS)
DROP POLICY IF EXISTS site_config_allow_all ON public.site_config;
CREATE POLICY site_config_allow_all ON public.site_config
FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- VERIFICATION QUERIES (Run these after setup)
-- =====================================================
SELECT 'Companies count:' as info, COUNT(*) as count FROM public.companies;
SELECT 'Users count:' as info, COUNT(*) as count FROM public.users;
SELECT 'Companies:' as info, name, domain FROM public.companies;
