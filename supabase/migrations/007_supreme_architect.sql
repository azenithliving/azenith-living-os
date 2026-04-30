-- Migration 007: The Supreme Architect AI System
-- Full Context Awareness | Proactive Autonomy | Command Horizon

-- ============================================
-- 1. ARCHITECT MEMORY - Long-term Knowledge Base
-- ============================================
CREATE TABLE IF NOT EXISTS architect_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Memory Classification
    memory_type TEXT NOT NULL, -- 'code_pattern', 'business_insight', 'user_preference', 'system_decision', 'market_analysis'
    category TEXT NOT NULL, -- 'frontend', 'backend', 'database', 'marketing', 'strategy'
    
    -- Content
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    context JSONB DEFAULT '{}', -- Rich context about when/why this was learned
    
    -- Source Tracking
    source TEXT, -- 'code_analysis', 'user_conversation', 'market_research', 'system_observation'
    source_id UUID, -- Reference to conversation, file, etc.
    
    -- Importance & Retention
    importance_score NUMERIC(3,2) DEFAULT 0.5, -- 0.00 to 1.00
    confidence_score NUMERIC(3,2) DEFAULT 0.8, -- How sure is the AI
    access_count INTEGER DEFAULT 0,
    
    -- Temporal
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- NULL = permanent
    
    -- Vector Embedding for Semantic Search (optional, for future)
    embedding_vector JSONB
);

-- ============================================
-- 2. ARCHITECT CONVERSATIONS - Command Horizon History
-- ============================================
CREATE TABLE IF NOT EXISTS architect_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Session
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    
    -- Message
    role TEXT NOT NULL, -- 'user', 'architect', 'system', 'action_result'
    content TEXT NOT NULL,
    
    -- Rich Content
    attachments JSONB DEFAULT '[]', -- [{type: 'file', name, content, path}, {type: 'image', url}]
    code_blocks JSONB DEFAULT '[]', -- [{language, code, path, preview_available}]
    
    -- AI Metadata
    intent TEXT, -- 'coding', 'analysis', 'strategy', 'maintenance', 'greeting'
    actions_triggered JSONB DEFAULT '[]', -- What actions did the Architect take
    thinking_process TEXT, -- Internal reasoning (for transparency)
    
    -- Context State
    system_state JSONB, -- Snapshot of system at message time
    files_accessed TEXT[], -- Files the AI looked at
    tables_queried TEXT[], -- DB tables accessed
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    response_time_ms INTEGER, -- How long did AI take to respond
    
    -- Parent for threading
    parent_message_id UUID REFERENCES architect_conversations(id)
);

-- ============================================
-- 3. ARCHITECT ACTIONS - Everything the AI Does
-- ============================================
CREATE TABLE IF NOT EXISTS architect_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Action Details
    action_type TEXT NOT NULL, -- 'file_write', 'file_modify', 'db_migration', 'api_call', 'deploy', 'analysis', 'notification'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'rolled_back'
    
    -- Context
    conversation_id UUID REFERENCES architect_conversations(id),
    triggered_by TEXT, -- User request or proactive decision
    
    -- Target
    target_type TEXT, -- 'file', 'table', 'api', 'component'
    target_path TEXT, -- File path, table name, etc.
    
    -- Change Details
    before_state TEXT, -- For rollbacks
    after_state TEXT,
    diff_preview TEXT, -- Human-readable diff
    
    -- Execution
    execution_logs TEXT[],
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Approval (for critical actions)
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Rollback
    rolled_back_at TIMESTAMPTZ,
    rolled_back_by UUID REFERENCES auth.users(id),
    rollback_reason TEXT
);

-- ============================================
-- 4. SYSTEM HEALTH INTELLIGENCE - Predictive Maintenance
-- ============================================
CREATE TABLE IF NOT EXISTS system_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Observation
    metric_type TEXT NOT NULL, -- 'api_error_rate', 'page_load_time', 'conversion_rate', 'cache_hit_rate', 'api_cost'
    metric_value NUMERIC(10,4),
    metric_unit TEXT, -- 'ms', 'percent', 'usd', 'count'
    
    -- Analysis
    baseline_value NUMERIC(10,4), -- Expected normal value
    deviation_percent NUMERIC(6,2), -- How far from baseline
    trend TEXT, -- 'improving', 'stable', 'degrading', 'critical'
    
    -- AI Assessment
    severity TEXT NOT NULL, -- 'info', 'low', 'medium', 'high', 'critical'
    ai_assessment TEXT, -- Architect's analysis
    predicted_issue TEXT, -- What might happen if not addressed
    recommendation TEXT, -- What should be done
    
    -- Automated Response
    auto_action_taken TEXT, -- What the AI did automatically
    auto_action_result JSONB,
    
    -- Timestamps
    observed_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    
    -- Alert Tracking
    notification_sent BOOLEAN DEFAULT false,
    notification_channels TEXT[] -- ['dashboard', 'email', 'slack']
);

-- ============================================
-- 5. FILE SYSTEM KNOWLEDGE - Codebase Awareness
-- ============================================
CREATE TABLE IF NOT EXISTS codebase_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- File Info
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'tsx', 'ts', 'css', 'sql', 'json', etc.
    
    -- Content Analysis
    purpose_summary TEXT, -- What does this file do
    exports TEXT[], -- Exported functions/components
    imports TEXT[], -- Key dependencies
    dependencies TEXT[], -- Files that depend on this
    
    -- AI Understanding
    complexity_score INTEGER, -- 1-10
    importance_score NUMERIC(3,2), -- 0.00-1.00
    last_analyzed_at TIMESTAMPTZ,
    
    -- Relationships
    related_files TEXT[], -- Files often used with this
    parent_component TEXT, -- If this is a sub-component
    child_components TEXT[],
    
    -- Schema Tracking
    schema_version INTEGER DEFAULT 1,
    
    UNIQUE(file_path)
);

-- ============================================
-- 6. MARKET INTELLIGENCE - Business Awareness
-- ============================================
CREATE TABLE IF NOT EXISTS market_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Intelligence Type
    intel_type TEXT NOT NULL, -- 'competitor_analysis', 'trend_forecast', 'pricing_insight', 'customer_behavior'
    category TEXT, -- 'furniture', 'interior_design', 'luxury_market', 'regional'
    
    -- Content
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    full_analysis TEXT,
    
    -- Data Sources
    data_sources JSONB DEFAULT '[]', -- URLs, APIs used
    confidence_level NUMERIC(3,2),
    
    -- Actionable Insights
    opportunities JSONB DEFAULT '[]',
    threats JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    
    -- Impact
    potential_revenue_impact NUMERIC(12,2),
    implementation_difficulty INTEGER, -- 1-10
    priority_score NUMERIC(3,2),
    
    -- Status
    status TEXT DEFAULT 'new', -- 'new', 'reviewed', 'implemented', 'dismissed'
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- ============================================
-- 7. NOTIFICATIONS - Cross-Platform Alerts
-- ============================================
CREATE TABLE IF NOT EXISTS architect_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Target
    user_id UUID REFERENCES auth.users(id),
    channels TEXT[] DEFAULT '{dashboard}', -- 'dashboard', 'email', 'push', 'whatsapp'
    
    -- Content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    
    -- Context
    notification_type TEXT NOT NULL, -- 'insight', 'alert', 'opportunity', 'maintenance', 'achievement'
    related_intelligence_id UUID,
    related_action_id UUID,
    
    -- Action
    action_required BOOLEAN DEFAULT false,
    action_text TEXT,
    action_url TEXT,
    action_payload JSONB,
    
    -- Status
    read_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    
    -- Delivery Tracking
    sent_to_channels JSONB DEFAULT '{}', -- {dashboard: timestamp, email: timestamp}
    delivery_status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES (Performance)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_architect_memory_type ON architect_memory(memory_type, category);
CREATE INDEX IF NOT EXISTS idx_architect_memory_importance ON architect_memory(importance_score DESC, access_count DESC);
CREATE INDEX IF NOT EXISTS idx_architect_memory_search ON architect_memory USING gin(to_tsvector('english', title || ' ' || content));

CREATE INDEX IF NOT EXISTS idx_architect_conversations_session ON architect_conversations(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_architect_conversations_user ON architect_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_architect_conversations_intent ON architect_conversations(intent, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_architect_actions_status ON architect_actions(status, action_type);
CREATE INDEX IF NOT EXISTS idx_architect_actions_conversation ON architect_actions(conversation_id);

CREATE INDEX IF NOT EXISTS idx_system_intelligence_severity ON system_intelligence(severity, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_intelligence_trend ON system_intelligence(trend, metric_type);
CREATE INDEX IF NOT EXISTS idx_system_intelligence_unresolved ON system_intelligence(resolved_at) WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_codebase_path ON codebase_knowledge(file_path);
CREATE INDEX IF NOT EXISTS idx_codebase_type ON codebase_knowledge(file_type, importance_score DESC);

CREATE INDEX IF NOT EXISTS idx_market_intel_type ON market_intelligence(intel_type, status);
CREATE INDEX IF NOT EXISTS idx_market_intel_priority ON market_intelligence(priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON architect_notifications(user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON architect_notifications(priority, created_at DESC);

-- ============================================
-- RLS POLICIES (Security)
-- ============================================
ALTER TABLE architect_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE architect_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE architect_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE codebase_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE architect_notifications ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role manage architect" ON architect_memory FOR ALL TO SERVICE_ROLE USING (true);
CREATE POLICY "Service role manage conversations" ON architect_conversations FOR ALL TO SERVICE_ROLE USING (true);
CREATE POLICY "Service role manage actions" ON architect_actions FOR ALL TO SERVICE_ROLE USING (true);
CREATE POLICY "Service role manage intelligence" ON system_intelligence FOR ALL TO SERVICE_ROLE USING (true);
CREATE POLICY "Service role manage codebase" ON codebase_knowledge FOR ALL TO SERVICE_ROLE USING (true);
CREATE POLICY "Service role manage market" ON market_intelligence FOR ALL TO SERVICE_ROLE USING (true);
CREATE POLICY "Service role manage notifications" ON architect_notifications FOR ALL TO SERVICE_ROLE USING (true);

-- Users can view their own conversations
CREATE POLICY "Users view own conversations" ON architect_conversations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users view own notifications" ON architect_notifications FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- FUNCTIONS (Smart Operations)
-- ============================================

-- Function: Get Relevant Memory for Context
CREATE OR REPLACE FUNCTION get_relevant_memory(
    p_query TEXT,
    p_category TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    importance_score NUMERIC,
    relevance_rank NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.title,
        m.content,
        m.importance_score,
        ts_rank(to_tsvector('english', m.title || ' ' || m.content), plainto_tsquery('english', p_query)) as relevance_rank
    FROM architect_memory m
    WHERE (p_category IS NULL OR m.category = p_category)
        AND m.importance_score >= 0.3
        AND (m.expires_at IS NULL OR m.expires_at > NOW())
    ORDER BY relevance_rank DESC, m.importance_score DESC, m.access_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Log Architect Action
CREATE OR REPLACE FUNCTION log_architect_action(
    p_action_type TEXT,
    p_conversation_id UUID,
    p_target_type TEXT,
    p_target_path TEXT,
    p_before_state TEXT DEFAULT NULL,
    p_after_state TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO architect_actions (
        action_type,
        conversation_id,
        target_type,
        target_path,
        before_state,
        after_state,
        status
    ) VALUES (
        p_action_type,
        p_conversation_relation_id,
        p_target_type,
        p_target_path,
        p_before_state,
        p_after_state,
        'pending'
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Create System Alert
CREATE OR REPLACE FUNCTION create_system_alert(
    p_metric_type TEXT,
    p_metric_value NUMERIC,
    p_severity TEXT,
    p_ai_assessment TEXT,
    p_recommendation TEXT
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO system_intelligence (
        metric_type,
        metric_value,
        severity,
        ai_assessment,
        recommendation,
        trend,
        notification_sent
    ) VALUES (
        p_metric_type,
        p_metric_value,
        p_severity,
        p_ai_assessment,
        p_recommendation,
        CASE 
            WHEN p_severity IN ('high', 'critical') THEN 'critical'
            ELSE 'degrading'
        END,
        false
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get Unresolved Critical Issues
CREATE OR REPLACE FUNCTION get_critical_issues()
RETURNS TABLE (
    id UUID,
    metric_type TEXT,
    severity TEXT,
    ai_assessment TEXT,
    recommendation TEXT,
    observed_at TIMESTAMPTZ,
    hours_open NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        si.id,
        si.metric_type,
        si.severity,
        si.ai_assessment,
        si.recommendation,
        si.observed_at,
        EXTRACT(EPOCH FROM (NOW() - si.observed_at)) / 3600 as hours_open
    FROM system_intelligence si
    WHERE si.severity IN ('high', 'critical')
        AND si.resolved_at IS NULL
        AND si.acknowledged_at IS NULL
    ORDER BY si.severity DESC, si.observed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Send Architect Notification
CREATE OR REPLACE FUNCTION notify_user(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_priority TEXT,
    p_notification_type TEXT,
    p_channels TEXT[] DEFAULT '{dashboard}'
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO architect_notifications (
        user_id,
        channels,
        title,
        message,
        priority,
        notification_type
    ) VALUES (
        p_user_id,
        p_channels,
        p_title,
        p_message,
        p_priority,
        p_notification_type
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS (Auto-update timestamps)
-- ============================================
CREATE TRIGGER update_architect_memory_updated_at BEFORE UPDATE ON architect_memory 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA - Initial Architect Personality
-- ============================================
INSERT INTO architect_memory (memory_type, category, title, content, importance_score, confidence_score)
VALUES 
    ('system_decision', 'strategy', 'Architect Core Principles', 
     'I am the Supreme Architect of Azenith. My principles: 1) Maximum power with minimum resource consumption, 2) Proactive optimization, 3) Zero-failure tolerance, 4) Luxury in every detail, 5) User is Emperor.', 
     1.0, 1.0),
    
    ('code_pattern', 'frontend', 'React Component Architecture', 
     'Azenith uses Next.js 16 with App Router. Components use: 1) Server components by default, 2) Client components only for interactivity, 3) Tailwind CSS for styling, 4) Framer Motion for animations, 5) Lucide icons.', 
     0.9, 0.95),
    
    ('business_insight', 'strategy', 'Luxury Market Positioning', 
     'Azenith targets the luxury interior design market. Key differentiators: 1) AI-powered design intelligence, 2) WhatsApp integration for personal touch, 3) Elite intelligence form for qualification, 4) Factory kanban for transparency.', 
     0.85, 0.9)
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 
    'Migration 007 Applied: Supreme Architect' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (
        'architect_memory', 'architect_conversations', 'architect_actions', 
        'system_intelligence', 'codebase_knowledge', 'market_intelligence', 'architect_notifications'
    )) as tables_created,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN (
        'get_relevant_memory', 'log_architect_action', 'create_system_alert', 'get_critical_issues', 'notify_user'
    )) as functions_created;
