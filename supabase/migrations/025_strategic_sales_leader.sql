-- Strategic Sales Leader System - Complete Implementation
-- نظام قائد المبيعات الاستراتيجي الكامل

-- ============================================
-- 1. قاعدة المعرفة (Knowledge Base)
-- ============================================
CREATE TABLE IF NOT EXISTS consultant_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,           -- مفتاح البحث (مثال: "أسعار_الأريكة")
  value TEXT NOT NULL,                -- الإجابة/القيمة
  category TEXT DEFAULT 'general',    -- الفئة: pricing, products, services, general
  usage_count INTEGER DEFAULT 0,      -- عدد مرات الاستخدام
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for knowledge base
CREATE INDEX IF NOT EXISTS idx_consultant_knowledge_category ON consultant_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_consultant_knowledge_usage ON consultant_knowledge(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_consultant_knowledge_key ON consultant_knowledge USING gin(to_tsvector('arabic', key));

-- ============================================
-- 2. الأسئلة المعلقة (Pending Questions)
-- ============================================
CREATE TABLE IF NOT EXISTS consultant_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,             -- السؤال المعلق
  asked_count INTEGER DEFAULT 1,      -- عدد مرات السؤال
  session_id TEXT,                    -- معرف الجلسة الأولى
  answered BOOLEAN DEFAULT FALSE,       -- هل تمت الإجابة؟
  answer TEXT,                        -- الإجابة عند توفرها
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for pending questions
CREATE INDEX IF NOT EXISTS idx_consultant_pending_answered ON consultant_pending(answered);
CREATE INDEX IF NOT EXISTS idx_consultant_pending_count ON consultant_pending(asked_count DESC);
CREATE INDEX IF NOT EXISTS idx_consultant_pending_question ON consultant_pending USING gin(to_tsvector('arabic', question));

-- ============================================
-- 3. زوار المستشار (Visitor Profiles)
-- ============================================
CREATE TABLE IF NOT EXISTS consultant_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,    -- معرف الجلسة
  name TEXT,                          -- اسم الزائر إذا توفر
  email TEXT,                         -- البريد إذا توفر
  phone TEXT,                         -- الهاتف إذا توفر
  last_conversation JSONB,            -- آخر محادثة (آخر 5 رسائل)
  interests JSONB,                    -- الاهتمامات المستخلصة
  mood TEXT DEFAULT 'neutral',        -- المزاج: happy, interested, neutral, hesitant, frustrated
  conversion_stage TEXT DEFAULT 'visitor', -- مرحلة التحويل: visitor, interested, qualified, converted, lost
  conversation_count INTEGER DEFAULT 0,    -- عدد المحادثات
  last_interaction_at TIMESTAMPTZ,      -- آخر تفاعل
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for visitors
CREATE INDEX IF NOT EXISTS idx_consultant_visitors_session ON consultant_visitors(session_id);
CREATE INDEX IF NOT EXISTS idx_consultant_visitors_mood ON consultant_visitors(mood);
CREATE INDEX IF NOT EXISTS idx_consultant_visitors_stage ON consultant_visitors(conversion_stage);
CREATE INDEX IF NOT EXISTS idx_consultant_visitors_updated ON consultant_visitors(updated_at DESC);

-- ============================================
-- 4. التقارير الأسبوعية (Weekly Reports Log)
-- ============================================
CREATE TABLE IF NOT EXISTS consultant_weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  top_questions JSONB,                -- أكثر الأسئلة تكراراً
  conversion_stats JSONB,             -- إحصائيات التحويل
  suggestions TEXT[],                 -- الاقتراحات
  total_visitors INTEGER DEFAULT 0,
  total_conversations INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE consultant_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultant_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultant_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultant_weekly_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service role
CREATE POLICY "Service role full access consultant_knowledge"
  ON consultant_knowledge FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access consultant_pending"
  ON consultant_pending FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access consultant_visitors"
  ON consultant_visitors FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access consultant_weekly_reports"
  ON consultant_weekly_reports FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================
-- 5. Functions for Usage Tracking
-- ============================================

-- Function to increment knowledge usage
CREATE OR REPLACE FUNCTION increment_knowledge_usage(knowledge_key TEXT)
RETURNS void AS $$
BEGIN
  UPDATE consultant_knowledge 
  SET usage_count = usage_count + 1, updated_at = NOW()
  WHERE key = knowledge_key;
END;
$$ LANGUAGE plpgsql;

-- Function to increment pending question count
CREATE OR REPLACE FUNCTION increment_pending_asked(question_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE consultant_pending 
  SET asked_count = asked_count + 1, updated_at = NOW()
  WHERE id = question_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Seed Data - Knowledge Base
-- ============================================

INSERT INTO consultant_knowledge (key, value, category) VALUES
('من_نحن', 'أزينث ليفينج هي شركة رائدة في التصميم الداخلي الفاخر في مصر. نقدم حلول تصميم متكاملة تجمع بين الأناقة والوظائف العملية.', 'general'),
('الخدمات', 'نقدم: 1) تصميم داخلي شامل، 2) إدارة المشاريع، 3) اختيار الأثاث والمفروشات، 4) الإشراف على التنفيذ، 5) التصميم الذكي للمنازل.', 'services'),
('كيف_نبدأ', 'البدء سهل: 1) حدد موعد استشارة مجانية، 2) نفهم احتياجاتك، 3) نقدم عرض سعر مخصص، 4) نبدأ رحلة التصميم.', 'services'),
('الموقع', 'مقرنا الرئيسي في القاهرة، ونخدم العملاء في جميع أنحاء مصر. يمكنك زيارتنا بالموعد المسبق أو التواصل أونلاين.', 'general'),
('ضمان_الجودة', 'نضمن جودة كل مشروع: ضمان سنة على الأعمال، متابعة ما بعد التسليم، ودعم مستمر طوال فترة التنفيذ.', 'services')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 7. Migration Note
-- ============================================
-- تم إنشاء هذا الملف في: 2026-04-15
-- الغرض: تنفيذ نظام قائد المبيعات الاستراتيجي الكامل
-- المكونات: قاعدة المعرفة، الأسئلة المعلقة، زوار المستشار، التقارير الأسبوعية
