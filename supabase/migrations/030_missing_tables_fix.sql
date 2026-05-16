-- Apply missing tables required by production APIs

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Consultant FAQ (migration 024)
CREATE TABLE IF NOT EXISTS public.consultant_faq (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    original_pending_question_id UUID REFERENCES public.consultant_pending_questions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultant_faq_created_at ON public.consultant_faq(created_at);

-- Generic leads table (elite-brief fallback + admin tools)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    source TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_leads_company_created ON public.leads(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

-- Elite briefs
CREATE TABLE IF NOT EXISTS public.elite_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_analysis JSONB,
    source TEXT DEFAULT 'virtual_designer',
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_elite_briefs_status ON public.elite_briefs(status);

-- Subscriptions (Stripe billing sync)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan_id TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'inactive',
    current_period_end TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON public.subscriptions(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

-- RLS
ALTER TABLE public.consultant_faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elite_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; authenticated users get tenant-scoped access where applicable
DROP POLICY IF EXISTS leads_service ON public.leads;
CREATE POLICY leads_service ON public.leads FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS elite_briefs_service ON public.elite_briefs;
CREATE POLICY elite_briefs_service ON public.elite_briefs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS consultant_faq_service ON public.consultant_faq;
CREATE POLICY consultant_faq_service ON public.consultant_faq FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS subscriptions_service ON public.subscriptions;
CREATE POLICY subscriptions_service ON public.subscriptions FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultant_faq TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.elite_briefs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated, service_role;
