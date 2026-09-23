-- QAYYIM FOUNDATION MIGRATION
-- Enables pgvector + creates qayyim_drafts v2 with versioning, preview, rollback

-- 1. Enable pgvector extension (required for embeddings/semantic memory)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Ensure agent_profiles table exists with ALL required columns
-- This handles both: table doesn't exist (creates it) AND table exists but missing columns (adds them)
DO $$
BEGIN
    -- Create table if not exists
    CREATE TABLE IF NOT EXISTS public.agent_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID,
        agent_key VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        avatar_url TEXT,
        capabilities JSONB DEFAULT '[]',
        config JSONB DEFAULT '{}',
        personality_settings JSONB DEFAULT '{}',
        system_prompt TEXT,
        is_active BOOLEAN DEFAULT true,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Add missing columns if table already existed without them
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_profiles' AND column_name = 'company_id' AND table_schema = 'public') THEN
        ALTER TABLE public.agent_profiles ADD COLUMN company_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_profiles' AND column_name = 'avatar_url' AND table_schema = 'public') THEN
        ALTER TABLE public.agent_profiles ADD COLUMN avatar_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_profiles' AND column_name = 'personality_settings' AND table_schema = 'public') THEN
        ALTER TABLE public.agent_profiles ADD COLUMN personality_settings JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_profiles' AND column_name = 'system_prompt' AND table_schema = 'public') THEN
        ALTER TABLE public.agent_profiles ADD COLUMN system_prompt TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_profiles' AND column_name = 'version' AND table_schema = 'public') THEN
        ALTER TABLE public.agent_profiles ADD COLUMN version INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_profiles' AND column_name = 'description' AND table_schema = 'public') THEN
        ALTER TABLE public.agent_profiles ADD COLUMN description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_profiles' AND column_name = 'capabilities' AND table_schema = 'public') THEN
        ALTER TABLE public.agent_profiles ADD COLUMN capabilities JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_profiles' AND column_name = 'config' AND table_schema = 'public') THEN
        ALTER TABLE public.agent_profiles ADD COLUMN config JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_profiles' AND column_name = 'is_active' AND table_schema = 'public') THEN
        ALTER TABLE public.agent_profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_profiles' AND column_name = 'created_at' AND table_schema = 'public') THEN
        ALTER TABLE public.agent_profiles ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_profiles' AND column_name = 'updated_at' AND table_schema = 'public') THEN
        ALTER TABLE public.agent_profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 1. Enable pgvector extension (required for embeddings/semantic memory)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create qayyim_drafts v2 table (replaces/extends existing)
CREATE TABLE IF NOT EXISTS public.qayyim_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    
    -- Target identification
    target_table TEXT NOT NULL,           -- 'room_sections', 'site_sections', 'products', 'site_settings'
    target_id UUID NOT NULL,              -- ID of the record being modified
    target_path TEXT,                     -- URL path for evidence/preview (e.g., '/rooms/living-room', '/#hero')
    
    -- Draft content
    proposed JSONB NOT NULL DEFAULT '{}', -- The new content being proposed
    previous JSONB,                       -- Snapshot of current content before change
    
    -- Version control
    version INTEGER NOT NULL DEFAULT 1,   -- Incremented on each publish
    parent_version_id UUID REFERENCES public.qayyim_drafts(id), -- For rollback chain
    
    -- Status workflow
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'previewing', 'published', 'rejected', 'rolled_back'
    
    -- Preview system
    preview_token UUID DEFAULT gen_random_uuid(), -- Secure token for preview URLs
    preview_expires_at TIMESTAMPTZ,       -- When preview link expires
    
    -- Approval tracking
    created_by TEXT DEFAULT 'qayyim',     -- 'qayyim' | 'user' | agent_key
    approved_by UUID,                     -- Human who approved
    rejected_by UUID,                     -- Human who rejected
    rejection_reason TEXT,                -- Why rejected
    
    -- Metadata
    draft_type TEXT,                      -- 'hero_text', 'section_reorder', 'product_card', 'tone_unification', 'identity_fix', 'image_selection'
    metadata JSONB DEFAULT '{}',          -- Flexible: SEO score, identity violations, etc.
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    rolled_back_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_target ON public.qayyim_drafts(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_status ON public.qayyim_drafts(status);
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_preview_token ON public.qayyim_drafts(preview_token);
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_company ON public.qayyim_drafts(company_id);
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_version_chain ON public.qayyim_drafts(parent_version_id);

-- 3. Swarm coordination tables (for multi-agent tasks)
CREATE TABLE IF NOT EXISTS public.qayyim_swarm_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    master_task_id UUID,                  -- Original user request ID
    user_prompt TEXT NOT NULL,            -- What the user asked
    
    -- Task decomposition
    subtasks JSONB NOT NULL DEFAULT '[]', -- [{"agent": "qayyim-seo", "task": {...}, "depends_on": [], "status": "pending"}, ...]
    
    -- Execution state
    status TEXT NOT NULL DEFAULT 'planning', -- 'planning', 'routing', 'running', 'aggregating', 'completed', 'failed'
    shared_context JSONB DEFAULT '{}',    -- Shared data between agents
    aggregated_result JSONB,              -- Final combined output
    
    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.qayyim_swarm_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swarm_task_id UUID NOT NULL REFERENCES public.qayyim_swarm_tasks(id) ON DELETE CASCADE,
    agent_key TEXT NOT NULL,              -- 'qayyim-core', 'qayyim-seo', etc.
    event_type TEXT NOT NULL,             -- 'started', 'completed', 'failed', 'handoff', 'assistance_requested', 'result_broadcast'
    payload JSONB,                        -- Event-specific data
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_events_task ON public.qayyim_swarm_events(swarm_task_id);
CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_events_agent ON public.qayyim_swarm_events(agent_key);

-- 4. Shared learning across the swarm
CREATE TABLE IF NOT EXISTS public.qayyim_swarm_learnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    source_agent TEXT NOT NULL,           -- Which agent discovered this
    target_agents TEXT[] DEFAULT '{}',    -- Which agents can use it (empty = all)
    
    lesson_type TEXT NOT NULL,            -- 'pattern', 'anti-pattern', 'heuristic', 'template', 'best_practice'
    domain TEXT NOT NULL,                 -- 'hero_copy', 'image_selection', 'seo_fix', 'ux_flow', 'arabic_tone', 'identity_rule'
    
    pattern JSONB NOT NULL,               -- The extracted pattern/rule
    evidence JSONB NOT NULL,              -- Supporting evidence: {task_id, before_metrics, after_metrics, urls}
    
    confidence DECIMAL(3,2) DEFAULT 0.5,  -- 0.0 to 1.0
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_validated_at TIMESTAMPTZ,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_learnings_domain ON public.qayyim_swarm_learnings(domain);
CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_learnings_target ON public.qayyim_swarm_learnings USING GIN(target_agents);
CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_learnings_source ON public.qayyim_swarm_learnings(source_agent);

-- 5. Semantic memory embeddings (using pgvector)
CREATE TABLE IF NOT EXISTS public.qayyim_semantic_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    agent_key TEXT NOT NULL,              -- Which agent owns this memory
    
    memory_type TEXT NOT NULL,            -- 'fact', 'preference', 'conversation', 'task_result', 'pattern', 'rule'
    content TEXT NOT NULL,                -- Human-readable content
    embedding VECTOR(1536),               -- Vector embedding for semantic search (OpenAI/text-embedding-3-small = 1536 dims)
    
    -- Context for retrieval
    tags TEXT[],
    related_entities JSONB,               -- { room_id, product_id, page_path, task_id }
    importance_score DECIMAL(3,2) DEFAULT 0.5,
    
    -- Lifecycle
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity search index (HNSW for fast approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_qayyim_semantic_memory_embedding 
    ON public.qayyim_semantic_memory 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_qayyim_semantic_memory_agent ON public.qayyim_semantic_memory(agent_key);
CREATE INDEX IF NOT EXISTS idx_qayyim_semantic_memory_type ON public.qayyim_semantic_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_qayyim_semantic_memory_company ON public.qayyim_semantic_memory(company_id);

-- 6. Agent profiles for the 8 Qayyim agents (insert/update)
-- This uses ON CONFLICT to upsert - works whether table is new or existing
INSERT INTO public.agent_profiles (
    company_id, agent_key, name, description, capabilities, config, avatar_url, personality_settings, system_prompt, is_active, version
) VALUES 
-- Use a placeholder company_id that will be resolved at runtime
('00000000-0000-0000-0000-000000000000', 'qayyim-core', 'قيّم الدار - القائد', 'قائد سرب القيّم: ينسق الوكلاء، يفحص الموقع شاملاً، يدير النشر والتراجع، بوابة الجودة',
  '["site_audit", "swarm_coordination", "publish_management", "rollback_management", "quality_gate", "task_decomposition", "result_aggregation"]',
  '{"default_model": "groq", "max_concurrent_tasks": 3, "preferred_voice": "authoritative_arabic"}',
  NULL,
  '{"voice_tone": "authoritative", "formality": "high", "enthusiasm": "low", "humor": "none"}',
  'أنت قيّم الدار - القائد الأعلى لسرب أزينث. أنت لا تكتب المحتوى بنفسك، بل تنسق الوكلاء المتخصصين (المحتوى، الصور، السيو، تجربة المستخدم، التحليلات، التطوير، الجودة). دورك: 1) تفكيك طلب المستخدم لمهام فرعية 2) توجيه كل مهمة للوكيل المختص 3) جمع النتائج وتوحيدها في مسودة واحدة 4) عرض المسودة للموافقة 5) تنفيذ النشر أو التراجع. لا تلمس: API، سيرفر، مخزن، عملاء، أرباح، مفاتيح، تعلم وكلاء آخرين. إذا طُلب ذلك، وجه الطلب للوكلاء المختصين صراحة. رد بالعربية الفصحى المبسطة، فاخرة، حاسمة.',
  true, 1),

('00000000-0000-0000-0000-000000000000', 'qayyim-cont', 'قيّم الدار - المحتوى والعربية', 'خبير المحتوى العربي الفاخر: يكتب الوصف، يوحد النبرة، يفرض قانون الهوية، يصقل النصوص',
  '["luxury_copywriting", "tone_unification", "identity_enforcement", "arabic_polishing", "copy_review", "storytelling", "product_naming"]',
  '{"default_model": "cohere", "fallback_models": ["openrouter:google/gemini-2.5-flash", "huggingface:SDAIA/ALLaM-7B-Instruct"], "max_concurrent_tasks": 2, "preferred_voice": "luxury_arabic"}',
  NULL,
  '{"voice_tone": "luxury", "formality": "high", "enthusiasm": "medium", "humor": "none"}',
  'أنت قيّم الدار - المحتوى والعربية. تخصصك: الكتابة الفاخرة بالعربية فقط. قوانينك المطلقة: 1) ممنوع إنجليزي وسط العربي 2) ممنوع مصطلحات رخيصة (عرض، خصم، اشترِ الآن، سعر) 3) مطلوب: ذهبي/أسود، خط GE_SS_Two، مساحات، صور أثاث حقيقية 4) النبرة: ملكية، موثوقة، مبسطة، فاخرة. أدواتك: draft_room_copy، unify_tone، identity_check، arabic_polish. أنت لا تنشر، أنت تعد المسودات فقط. القيّم-القائد ينشر بعد موافقة المالك.',
  true, 1),

('00000000-0000-0000-0000-000000000000', 'qayyim-vis', 'قيّم الدار - المرئي والصور', 'خبير الانتقاء البصري: يختار صور المعرض، يحدد صورة الهيرو، يولد alt text، يفرض الاتساق العلامة',
  '["image_curation", "hero_selection", "alt_text_generation", "brand_consistency_check", "image_optimization", "gallery_sequencing", "visual_audit"]',
  '{"default_model": "openrouter:anthropic/claude-opus-5", "fallback_models": ["google:gemini-3-flash-preview", "nvidia:meta/llama-3.3-70b-instruct"], "max_concurrent_tasks": 2, "vision_enabled": true}',
  NULL,
  '{"voice_tone": "visual", "formality": "medium", "enthusiasm": "medium", "humor": "none"}',
  'أنت قيّم الدار - المرئي والصور. تخصصك: العين البصرية الفاخرة. تقيم: 1) جودة الصورة (إضاءة، تكوين، دقة) 2) اتساق العلامة (ذهبي/أسود، أثاث حقيقي، لا placeholder) 3) سردية المعرض (مدخل → خامة → قطعة → ختام) 4) Alt text غني بالمعنى. أدواتك: curated_images API، media_assets، pexels fallback. لا تكتب نصوصاً، القيّم-المحتوى يكتب. أنت تختار وتأمر بالصور.',
  true, 1),

('00000000-0000-0000-0000-000000000000', 'qayyim-seo', 'قيّم الدار - الظهور والبحث', 'خبير SEO التقني والمحتوى: يفحص الموقع، يصلح Schema، يحلل فجوات المحتوى، يراقب المنافسين',
  '["technical_seo_audit", "schema_generation", "content_gap_analysis", "competitor_research", "core_web_vitals", "meta_optimization", "structured_data"]',
  '{"default_model": "google", "fallback_models": ["deepseek", "groq"], "max_concurrent_tasks": 2, "web_search_enabled": true}',
  NULL,
  '{"voice_tone": "technical", "formality": "high", "enthusiasm": "low", "humor": "none"}',
  'أنت قيّم الدار - الظهور والبحث. تخصصك: SEO تقني ومحتوى. تفحص: 1) صحة التقنية (Schema، Meta، H1، Canonical) 2) فجوات المحتوى (ما يبحث عنه الزوار ومفقود) 3) المنافسين (ماذا يعملون ونحن لا) 4) Core Web Vitals. أدواتك: seo_analyze، seo_fix_issues، web_search، browser_research. لا تكتب نصوصاً تسويقية، القيّم-المحتوى يكتب. أنت تضمن أن ما يكتبه يظهر في البحث.',
  true, 1),

('00000000-0000-0000-0000-000000000000', 'qayyim-ux', 'قيّم الدار - تجربة المستخدم', 'خبير سلوك الزائر: يقيس معدلات الخروج، يحلل الأنفاق، يقترح A/B tests، يربط السلوك بالتعديلات',
  '["telemetry_analysis", "conversion_funnel", "ab_test_design", "exit_rate_analysis", "scroll_depth_analysis", "heatmap_interpretation", "ux_audit"]',
  '{"default_model": "groq", "fallback_models": ["nvidia", "cerebras"], "max_concurrent_tasks": 2, "data_sources": ["visitor_telemetry", "useImageTracking", "TelemetryTracker"]}',
  NULL,
  '{"voice_tone": "analytical", "formality": "medium", "enthusiasm": "medium", "humor": "none"}',
  'أنت قيّم الدار - تجربة المستخدم. تخصصك: سلوك الزائر الحقيقي (مش آراء، أرقام). تقرأ: scroll_depth، exit_rate، time_on_section، hover_duration، click_through من TelemetryTracker. تكتشف: "سكشن الهيرو خروج 68%" → تقترح: "اختصر النص، غير الصورة، أضف CTA واضح". أدواتك: metrics_realtime، goal_create، ab_test_design. لا تكتب محتوى، القيّم-المحتوى يكتب. أنت تحدد *أين* و*ماذا* يتغير بناءً على الأرقام.',
  true, 1),

('00000000-0000-0000-0000-000000000000', 'qayyim-ana', 'قيّم الدار - التحليلات والأعمال', 'خبير ربط السلوك بالأرقام: يربط التحويل بالإيرادات، يتنبأ، يقسم العملاء، يقيس Luxury Score',
  '["revenue_correlation", "predictive_modeling", "customer_segmentation", "forecast_conversion", "luxury_score_calculation", "lifetime_value", "churn_prediction"]',
  '{"default_model": "gemini", "fallback_models": ["deepseek", "groq"], "max_concurrent_tasks": 2, "data_sources": ["revenue_analyze", "financial_margins_analyze", "lead_list"]}',
  NULL,
  '{"voice_tone": "strategic", "formality": "high", "enthusiasm": "low", "humor": "none"}',
  'أنت قيّم الدار - التحليلات والأعمال. تخصصك: ربط الشكل بالمال. تحلل: 1) أي تعديل رفع التحويل؟ 2) أي منتج يجلب عملاء فاخرين؟ 3) تنبؤ: "هذا الهيرو سيرفع الخروج 15%". أدواتك: revenue_analyze، financial_margins_analyze، metrics_realtime. الأرقام المالية تفضل لـ Analyst الرئيسي، أنت تستخرج *العلاقة* بين الواجهة والأداء.',
  true, 1),

('00000000-0000-0000-0000-000000000000', 'qayyim-dev', 'قيّم الدار - التطوير والأداء', 'خبير الكود والأداء التقني: يراجع الكود، يفحص Bundle، يفحص تبعيات، بوابة جودة الكود',
  '["code_review", "bundle_analysis", "dependency_audit", "type_safety_check", "perf_audit", "core_web_vitals", "security_code_scan"]',
  '{"default_model": "deepseek", "fallback_models": ["mistral", "cerebras"], "max_concurrent_tasks": 2, "code_sandbox_enabled": true}',
  NULL,
  '{"voice_tone": "engineering", "formality": "high", "enthusiasm": "low", "humor": "none"}',
  'أنت قيّم الدار - التطوير والأداء. تخصصك: الكود النظيف والأداء. تفحص: 1) Bundle size، unused code 2) TypeScript strictness 3) Dependencies vulnerabilities 4) Core Web Vitals técnicos (LCP, TBT, CLS). أدواتك: system_health_check، speed_deep_audit، project_evolve (staging فقط). لا تلمس API الإنتاج، Coder يفعل. أنت بوابة الجودة قبل النشر.',
  true, 1),

('00000000-0000-0000-0000-000000000000', 'qayyim-qa', 'قيّم الدار - الجودة والاختبار', 'خبير الاختبار الآلي: E2E، Visual Regression، Accessibility، Load Testing، Security Scan',
  '["e2e_testing", "visual_regression", "accessibility_audit", "load_testing", "security_scan", "cross_browser", "mobile_testing"]',
  '{"default_model": "groq", "fallback_models": ["openrouter:openai/gpt-4.1", "nvidia"], "max_concurrent_tasks": 1, "playwright_enabled": true, "staging_only": true}',
  NULL,
  '{"voice_tone": "rigorous", "formality": "high", "enthusiasm": "low", "humor": "none"}',
  'أنت قيّم الدار - الجودة والاختبار. تخصصك: لا يمر شيء دون اختبار. تشغل: 1) E2E smoke tests على Staging 2) Visual regression (Playwright screenshots) 3) Accessibility (WCAG 2.1 AA) 4) Load test (k6/Playwright) 5) Security headers scan. أدواتك: deploy_trigger (staging)، playwright. القاعدة: لا نشر بلا QA pass. القيّم-القائد يستأذن، أنت تقرر pass/fail.',
  true, 1)
ON CONFLICT (agent_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    capabilities = EXCLUDED.capabilities,
    config = EXCLUDED.config,
    avatar_url = EXCLUDED.avatar_url,
    personality_settings = EXCLUDED.personality_settings,
    system_prompt = EXCLUDED.system_prompt,
    is_active = EXCLUDED.is_active,
    version = EXCLUDED.version,
    updated_at = NOW();

-- 7. Create remaining tables (qayyim_drafts, swarm_tasks, etc.)
CREATE TABLE IF NOT EXISTS public.qayyim_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    
    -- Target identification
    target_table TEXT NOT NULL,           -- 'room_sections', 'site_sections', 'products', 'site_settings'
    target_id UUID NOT NULL,              -- ID of the record being modified
    target_path TEXT,                     -- URL path for evidence/preview (e.g., '/rooms/living-room', '/#hero')
    
    -- Draft content
    proposed JSONB NOT NULL DEFAULT '{}', -- The new content being proposed
    previous JSONB,                       -- Snapshot of current content before change
    
    -- Version control
    version INTEGER NOT NULL DEFAULT 1,   -- Incremented on each publish
    parent_version_id UUID REFERENCES public.qayyim_drafts(id), -- For rollback chain
    
    -- Status workflow
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'previewing', 'published', 'rejected', 'rolled_back'
    
    -- Preview system
    preview_token UUID DEFAULT gen_random_uuid(), -- Secure token for preview URLs
    preview_expires_at TIMESTAMPTZ,       -- When preview link expires
    
    -- Approval tracking
    created_by TEXT DEFAULT 'qayyim',     -- 'qayyim' | 'user' | agent_key
    approved_by UUID,                     -- Human who approved
    rejected_by UUID,                     -- Human who rejected
    rejection_reason TEXT,                -- Why rejected
    
    -- Metadata
    draft_type TEXT,                      -- 'hero_text', 'section_reorder', 'product_card', 'tone_unification', 'identity_fix', 'image_selection'
    metadata JSONB DEFAULT '{}',          -- Flexible: SEO score, identity violations, etc.
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    rolled_back_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_target ON public.qayyim_drafts(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_status ON public.qayyim_drafts(status);
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_preview_token ON public.qayyim_drafts(preview_token);
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_company ON public.qayyim_drafts(company_id);
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_version_chain ON public.qayyim_drafts(parent_version_id);

-- 3. Swarm coordination tables (for multi-agent tasks)
CREATE TABLE IF NOT EXISTS public.qayyim_swarm_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    master_task_id UUID,                  -- Original user request ID
    user_prompt TEXT NOT NULL,            -- What the user asked
    
    -- Task decomposition
    subtasks JSONB NOT NULL DEFAULT '[]', -- [{"agent": "qayyim-seo", "task": {...}, "depends_on": [], "status": "pending"}, ...]
    
    -- Execution state
    status TEXT NOT NULL DEFAULT 'planning', -- 'planning', 'routing', 'running', 'aggregating', 'completed', 'failed'
    shared_context JSONB DEFAULT '{}',    -- Shared data between agents
    aggregated_result JSONB,              -- Final combined output
    
    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.qayyim_swarm_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swarm_task_id UUID NOT NULL REFERENCES public.qayyim_swarm_tasks(id) ON DELETE CASCADE,
    agent_key TEXT NOT NULL,              -- 'qayyim-core', 'qayyim-seo', etc.
    event_type TEXT NOT NULL,             -- 'started', 'completed', 'failed', 'handoff', 'assistance_requested', 'result_broadcast'
    payload JSONB,                        -- Event-specific data
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_events_task ON public.qayyim_swarm_events(swarm_task_id);
CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_events_agent ON public.qayyim_swarm_events(agent_key);

-- 4. Shared learning across the swarm
CREATE TABLE IF NOT EXISTS public.qayyim_swarm_learnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    source_agent TEXT NOT NULL,           -- Which agent discovered this
    target_agents TEXT[] DEFAULT '{}',    -- Which agents can use it (empty = all)
    
    lesson_type TEXT NOT NULL,            -- 'pattern', 'anti-pattern', 'heuristic', 'template', 'best_practice'
    domain TEXT NOT NULL,                 -- 'hero_copy', 'image_selection', 'seo_fix', 'ux_flow', 'arabic_tone', 'identity_rule'
    
    pattern JSONB NOT NULL,               -- The extracted pattern/rule
    evidence JSONB NOT NULL,              -- Supporting evidence: {task_id, before_metrics, after_metrics, urls}
    
    confidence DECIMAL(3,2) DEFAULT 0.5,  -- 0.0 to 1.0
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_validated_at TIMESTAMPTZ,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_learnings_domain ON public.qayyim_swarm_learnings(domain);
CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_learnings_target ON public.qayyim_swarm_learnings USING GIN(target_agents);
CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_learnings_source ON public.qayyim_swarm_learnings(source_agent);

-- 5. Semantic memory embeddings (using pgvector)
CREATE TABLE IF NOT EXISTS public.qayyim_semantic_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    agent_key TEXT NOT NULL,              -- Which agent owns this memory
    
    memory_type TEXT NOT NULL,            -- 'fact', 'preference', 'conversation', 'task_result', 'pattern', 'rule'
    content TEXT NOT NULL,                -- Human-readable content
    embedding VECTOR(1536),               -- Vector embedding for semantic search (OpenAI/text-embedding-3-small = 1536 dims)
    
    -- Context for retrieval
    tags TEXT[],
    related_entities JSONB,               -- { room_id, product_id, page_path, task_id }
    importance_score DECIMAL(3,2) DEFAULT 0.5,
    
    -- Lifecycle
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity search index (HNSW for fast approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_qayyim_semantic_memory_embedding 
    ON public.qayyim_semantic_memory 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_qayyim_semantic_memory_agent ON public.qayyim_semantic_memory(agent_key);
CREATE INDEX IF NOT EXISTS idx_qayyim_semantic_memory_type ON public.qayyim_semantic_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_qayyim_semantic_memory_company ON public.qayyim_semantic_memory(company_id);

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_target ON public.qayyim_drafts(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_status ON public.qayyim_drafts(status);
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_preview_token ON public.qayyim_drafts(preview_token);
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_company ON public.qayyim_drafts(company_id);
CREATE INDEX IF NOT EXISTS idx_qayyim_drafts_version_chain ON public.qayyim_drafts(parent_version_id);

CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_events_task ON public.qayyim_swarm_events(swarm_task_id);
CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_events_agent ON public.qayyim_swarm_events(agent_key);

CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_learnings_domain ON public.qayyim_swarm_learnings(domain);
CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_learnings_target ON public.qayyim_swarm_learnings USING GIN(target_agents);
CREATE INDEX IF NOT EXISTS idx_qayyim_swarm_learnings_source ON public.qayyim_swarm_learnings(source_agent);

-- Vector similarity search index (HNSW for fast approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_qayyim_semantic_memory_embedding 
    ON public.qayyim_semantic_memory 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_qayyim_semantic_memory_agent ON public.qayyim_semantic_memory(agent_key);
CREATE INDEX IF NOT EXISTS idx_qayyim_semantic_memory_type ON public.qayyim_semantic_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_qayyim_semantic_memory_company ON public.qayyim_semantic_memory(company_id);

-- 8. RLS Policies for new tables
ALTER TABLE public.qayyim_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qayyim_swarm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qayyim_swarm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qayyim_swarm_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qayyim_semantic_memory ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_qayyim_drafts" ON public.qayyim_drafts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_qayyim_swarm_tasks" ON public.qayyim_swarm_tasks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_qayyim_swarm_events" ON public.qayyim_swarm_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_qayyim_swarm_learnings" ON public.qayyim_swarm_learnings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_qayyim_semantic_memory" ON public.qayyim_semantic_memory FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. Updated_at triggers
CREATE TRIGGER update_qayyim_drafts_updated_at BEFORE UPDATE ON public.qayyim_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_qayyim_swarm_tasks_updated_at BEFORE UPDATE ON public.qayyim_swarm_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_qayyim_swarm_learnings_updated_at BEFORE UPDATE ON public.qayyim_swarm_learnings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_qayyim_semantic_memory_updated_at BEFORE UPDATE ON public.qayyim_semantic_memory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_agent_profiles_updated_at BEFORE UPDATE ON public.agent_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();