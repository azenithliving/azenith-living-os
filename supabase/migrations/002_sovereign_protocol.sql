-- Migration 002: Azenith Sovereign Protocol
-- Implements: Recovery Vault, RBAC Team Management, Visual CMS, Factory Kanban, Intelligence Lake

-- Enable UUID extension (if not already)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. VAULT AUTHENTICATION (Recovery Codes Only)
-- ============================================
CREATE TABLE IF NOT EXISTS recovery_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Encrypted Recovery Codes (AES-256-GCM)
    recovery_codes_encrypted TEXT NOT NULL,
    
    -- Trusted Devices (long-lived sessions)
    trusted_devices JSONB DEFAULT '[]',
    
    -- Offline Master Hash (PBKDF2 fragment for emergency recovery)
    master_hash_fragment TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_admin_vault UNIQUE (admin_id)
);

-- ============================================
-- 2. TEAM RBAC (Role-Based Access Control)
-- ============================================
CREATE TABLE IF NOT EXISTS team_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Role Definition
    name TEXT NOT NULL, -- 'Admin', 'Editor', 'Factory Manager', 'Viewer'
    slug TEXT NOT NULL, -- 'admin', 'editor', 'factory_manager', 'viewer'
    
    -- Permissions Matrix (hardcoded for stability, extensible via JSONB)
    permissions JSONB NOT NULL DEFAULT '{
        "site_config": false,
        "media": false,
        "leads": false,
        "requests": false,
        "revenue": false,
        "factory": false,
        "team_management": false,
        "analytics": false,
        "newsletter": false
    }'::jsonb,
    
    -- Role hierarchy (lower = less permissions)
    hierarchy_level INTEGER NOT NULL DEFAULT 100, -- 1=Admin, 50=Editor, 100=Viewer
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, slug)
);

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES team_roles(id) ON DELETE CASCADE,
    
    -- Member Identity
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    
    -- Inviter tracking
    invited_by UUID REFERENCES auth.users(id),
    
    -- Status workflow
    status TEXT DEFAULT 'pending', -- 'pending', 'active', 'suspended', 'removed'
    
    -- Invitations
    invitation_token TEXT, -- For email verification
    invitation_expires_at TIMESTAMPTZ,
    
    -- Timestamps
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. VISUAL CMS (No-Code Site Configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS site_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Section Identifier
    section_key TEXT NOT NULL, -- 'hero', 'pricing', 'cta_section_1', 'footer'
    section_type TEXT NOT NULL DEFAULT 'content', -- 'hero', 'pricing', 'grid', 'form', 'footer'
    
    -- Content (fully flexible JSONB)
    content JSONB NOT NULL DEFAULT '{
        "title": "",
        "subtitle": "",
        "body": "",
        "button_text": "",
        "button_link": "",
        "enabled": true,
        "order": 0
    }'::jsonb,
    
    -- Media Assets (auto-compressed)
    media_urls JSONB DEFAULT '[]', -- [{url, type: 'image'|'video', alt, position, compression_metadata}]
    
    -- Versioning
    version INTEGER DEFAULT 1,
    
    -- Publishing
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES auth.users(id),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, section_key)
);

-- ============================================
-- 4. FACTORY KANBAN PIPELINE
-- ============================================
CREATE TABLE IF NOT EXISTS factory_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Stage Definition
    name TEXT NOT NULL, -- 'Design', 'Carpentry', 'Upholstery', 'Quality Control', 'Delivery'
    slug TEXT NOT NULL, -- 'design', 'carpentry', 'upholstery', 'qc', 'delivery'
    
    -- Pipeline Position
    position INTEGER NOT NULL, -- 1, 2, 3, 4, 5
    
    -- Visual
    color TEXT DEFAULT '#C5A059',
    icon TEXT, -- Lucide icon name
    
    -- Automation
    auto_notify_customer BOOLEAN DEFAULT false,
    notification_template TEXT, -- Message template for WhatsApp/email
    
    -- SLA (Service Level Agreement)
    sla_hours INTEGER, -- Expected hours in this stage
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, slug)
);

CREATE TABLE IF NOT EXISTS factory_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES factory_stages(id) ON DELETE CASCADE,
    
    -- Assignment
    assignee UUID REFERENCES team_members(id),
    
    -- Card Details
    priority INTEGER DEFAULT 0, -- 0=normal, 1=high, 2=urgent
    priority_reason TEXT, -- Why urgent?
    
    -- Workflow Notes
    notes TEXT,
    checklist JSONB DEFAULT '[]', -- [{text, completed, completed_by, completed_at}]
    
    -- Customer Communication
    customer_notified BOOLEAN DEFAULT false,
    customer_notification_sent_at TIMESTAMPTZ,
    
    -- Timeline Tracking
    started_at TIMESTAMPTZ, -- When entered this stage
    completed_at TIMESTAMPTZ, -- When marked complete
    
    -- Audit Trail
    moved_at TIMESTAMPTZ DEFAULT NOW(),
    moved_by UUID REFERENCES auth.users(id),
    moved_from_stage UUID REFERENCES factory_stages(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. INTELLIGENCE LAKE (Materialized Analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS intelligence_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Snapshot Date (for daily aggregations)
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Lead Intelligence
    total_leads INTEGER DEFAULT 0,
    new_leads_today INTEGER DEFAULT 0,
    elite_leads INTEGER DEFAULT 0, -- score >= 40
    
    -- Request Intelligence
    total_requests INTEGER DEFAULT 0,
    new_requests_today INTEGER DEFAULT 0,
    conversion_rate NUMERIC(5,2) DEFAULT 0,
    
    -- Newsletter Intelligence
    total_subscribers INTEGER DEFAULT 0,
    new_subscribers_today INTEGER DEFAULT 0,
    
    -- Factory Intelligence
    factory_velocity JSONB DEFAULT '{}', -- {stage_slug: avg_hours}
    cards_in_progress INTEGER DEFAULT 0,
    cards_completed_today INTEGER DEFAULT 0,
    
    -- Financial Intelligence
    revenue_estimate NUMERIC(12,2) DEFAULT 0,
    pending_payment_total NUMERIC(12,2) DEFAULT 0,
    
    -- Behavioral Intelligence
    top_room_types JSONB DEFAULT '[]', -- [{type, count, percentage}]
    top_styles JSONB DEFAULT '[]', -- [{style, count, percentage}]
    intent_distribution JSONB DEFAULT '{}', -- {browsing: 50, interested: 30, buyer: 20}
    
    -- System Health
    whatsapp_clicks_today INTEGER DEFAULT 0,
    average_lead_score NUMERIC(5,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, snapshot_date)
);

-- ============================================
-- 6. AUDIT LOG (Comprehensive Activity Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS sovereign_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Actor
    actor_id UUID REFERENCES auth.users(id),
    actor_type TEXT NOT NULL DEFAULT 'user', -- 'user', 'system', 'automation'
    
    -- Target
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Action
    action TEXT NOT NULL, -- 'login', 'biometric_auth', 'recovery_code_used', 'stage_moved', 'config_updated'
    entity_type TEXT NOT NULL, -- 'auth', 'factory_card', 'site_config', 'team_member'
    entity_id UUID,
    
    -- Details
    payload JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES (Performance)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_recovery_vault_admin ON recovery_vault(admin_id);
CREATE INDEX IF NOT EXISTS idx_recovery_vault_credential ON recovery_vault(webauthn_credential_id);

CREATE INDEX IF NOT EXISTS idx_team_roles_company ON team_roles(company_id, slug);
CREATE INDEX IF NOT EXISTS idx_team_members_company ON team_members(company_id, status);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);

CREATE INDEX IF NOT EXISTS idx_site_config_company ON site_config(company_id, section_key);
CREATE INDEX IF NOT EXISTS idx_site_config_published ON site_config(company_id, published_at);

CREATE INDEX IF NOT EXISTS idx_factory_stages_company ON factory_stages(company_id, position);
CREATE INDEX IF NOT EXISTS idx_factory_cards_request ON factory_cards(request_id);
CREATE INDEX IF NOT EXISTS idx_factory_cards_stage ON factory_cards(company_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_factory_cards_assignee ON factory_cards(assignee);

CREATE INDEX IF NOT EXISTS idx_intelligence_company_date ON intelligence_snapshots(company_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON sovereign_audit_logs(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON sovereign_audit_logs(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON sovereign_audit_logs(action, entity_type);

-- ============================================
-- RLS POLICIES (Security)
-- ============================================
ALTER TABLE recovery_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own vault" ON recovery_vault FOR ALL USING (admin_id = auth.uid());

ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company roles isolation" ON team_roles FOR ALL USING (company_id = current_company_id());

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members isolation" ON team_members FOR ALL USING (company_id = current_company_id());

ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company config isolation" ON site_config FOR ALL USING (company_id = current_company_id());

ALTER TABLE factory_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company stages isolation" ON factory_stages FOR ALL USING (company_id = current_company_id());

ALTER TABLE factory_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company cards isolation" ON factory_cards FOR ALL USING (company_id = current_company_id());

ALTER TABLE intelligence_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company intelligence isolation" ON intelligence_snapshots FOR ALL USING (company_id = current_company_id());

ALTER TABLE sovereign_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company audit isolation" ON sovereign_audit_logs FOR ALL USING (company_id = current_company_id());

-- ============================================
-- TRIGGERS (Auto-update timestamps)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_recovery_vault_updated_at BEFORE UPDATE ON recovery_vault FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_roles_updated_at BEFORE UPDATE ON team_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_site_config_updated_at BEFORE UPDATE ON site_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_factory_stages_updated_at BEFORE UPDATE ON factory_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_factory_cards_updated_at BEFORE UPDATE ON factory_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_intelligence_snapshots_updated_at BEFORE UPDATE ON intelligence_snapshots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA: Default Factory Stages Template
-- ============================================
-- This will be copied for each new tenant
INSERT INTO factory_stages (company_id, name, slug, position, color, auto_notify_customer, sla_hours)
SELECT 
    id as company_id,
    stage.name,
    stage.slug,
    stage.position,
    stage.color,
    stage.auto_notify,
    stage.sla
FROM companies
CROSS JOIN (VALUES 
    ('Design', 'design', 1, '#3B82F6', false, 48),
    ('Carpentry', 'carpentry', 2, '#8B5CF6', false, 72),
    ('Upholstery', 'upholstery', 3, '#F59E0B', false, 48),
    ('Quality Control', 'qc', 4, '#10B981', true, 24),
    ('Delivery', 'delivery', 5, '#C5A059', true, 48)
) AS stage(name, slug, position, color, auto_notify, sla)
WHERE NOT EXISTS (
    SELECT 1 FROM factory_stages WHERE factory_stages.company_id = companies.id
);

-- ============================================
-- SEED DATA: Default Team Roles
-- ============================================
INSERT INTO team_roles (company_id, name, slug, permissions, hierarchy_level)
SELECT 
    id as company_id,
    role.name,
    role.slug,
    role.permissions,
    role.hierarchy
FROM companies
CROSS JOIN (VALUES 
    ('Admin', 'admin', '{"site_config": true, "media": true, "leads": true, "requests": true, "revenue": true, "factory": true, "team_management": true, "analytics": true, "newsletter": true}'::jsonb, 1),
    ('Editor', 'editor', '{"site_config": true, "media": true, "leads": false, "requests": false, "revenue": false, "factory": false, "team_management": false, "analytics": false, "newsletter": true}'::jsonb, 50),
    ('Factory Manager', 'factory_manager', '{"site_config": false, "media": false, "leads": true, "requests": true, "revenue": false, "factory": true, "team_management": false, "analytics": true, "newsletter": false}'::jsonb, 50),
    ('Viewer', 'viewer', '{"site_config": false, "media": false, "leads": false, "requests": false, "revenue": false, "factory": false, "team_management": false, "analytics": true, "newsletter": false}'::jsonb, 100)
) AS role(name, slug, permissions, hierarchy)
WHERE NOT EXISTS (
    SELECT 1 FROM team_roles WHERE team_roles.company_id = companies.id
);

-- ============================================
-- VERIFICATION QUERY
-- ============================================
SELECT 
    'Migration 002 Applied Successfully' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (
        'recovery_vault', 'team_roles', 'team_members', 'site_config', 
        'factory_stages', 'factory_cards', 'intelligence_snapshots', 'sovereign_audit_logs'
    )) as tables_created;
