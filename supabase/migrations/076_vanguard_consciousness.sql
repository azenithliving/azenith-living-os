-- ============================================================
-- 076_vanguard_consciousness.sql
-- Vanguard Sales Ops Nervous System — Core Schema
-- ============================================================
-- Tables:
--   vanguard_materials            — product/material knowledge base
--   vanguard_products             — finished goods catalog
--   vanguard_knowledge_relations  — material/product graph edges
--   vanguard_learnings            — admin-corrected facts (Tier 3 citations)
--   vanguard_leads                — CRM pipeline
--   vanguard_embeddings           — pgvector semantic memory (all entity types)
--   vanguard_consciousness_state  — persisted consciousness snapshot
--   vanguard_background_tasks     — swarm agent job queue
--   vanguard_evolution_history    — self-improvement audit log
--   vanguard_api_usage            — cost & token tracking (prove $0)
--   vanguard_verification_log     — citation audit trail
-- ============================================================

-- ── Prerequisites ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure set_updated_at() trigger function exists (created in 001_create_schema.sql)
-- Guard in case this migration runs in isolation
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 1. vanguard_materials
--    Knowledge base for wood species, metal finishes, fabrics,
--    and any other material the showroom works with.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vanguard_materials (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT        NOT NULL UNIQUE,
  name_ar         TEXT        NOT NULL,
  name_en         TEXT,
  category        TEXT        NOT NULL,  -- 'wood','metal','fabric','stone','paint','glass'
  sub_category    TEXT,
  properties      JSONB       NOT NULL DEFAULT '{}',
  -- e.g. {"hardness": "high", "grain": "straight", "humidity_tolerance": "medium"}
  compatible_with TEXT[]      NOT NULL DEFAULT '{}',  -- slugs of compatible materials
  use_cases       TEXT[]      NOT NULL DEFAULT '{}',  -- 'bedroom','living_room','kitchen'…
  certifications  TEXT[]      NOT NULL DEFAULT '{}',
  source_country  TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  confidence      NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_vanguard_materials_category  ON public.vanguard_materials(category);
CREATE INDEX IF NOT EXISTS idx_vanguard_materials_slug      ON public.vanguard_materials(slug);
CREATE INDEX IF NOT EXISTS idx_vanguard_materials_active    ON public.vanguard_materials(is_active);
CREATE INDEX IF NOT EXISTS idx_vanguard_materials_compat    ON public.vanguard_materials USING GIN(compatible_with);
CREATE INDEX IF NOT EXISTS idx_vanguard_materials_uses      ON public.vanguard_materials USING GIN(use_cases);

-- ════════════════════════════════════════════════════════════
-- 2. vanguard_products
--    Finished goods: bedroom sets, sofas, tables, etc.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vanguard_products (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT        NOT NULL UNIQUE,
  name_ar         TEXT        NOT NULL,
  name_en         TEXT,
  category        TEXT        NOT NULL,  -- 'bedroom','living_room','dining','office','kitchen'
  sub_category    TEXT,
  style           TEXT,                  -- 'classic','modern','contemporary','luxury'
  materials       TEXT[]      NOT NULL DEFAULT '{}',  -- slugs of vanguard_materials
  dimensions      JSONB       NOT NULL DEFAULT '{}',
  -- {"width_cm": 180, "height_cm": 210, "depth_cm": 60}
  features        TEXT[]      NOT NULL DEFAULT '{}',
  customizable    BOOLEAN     NOT NULL DEFAULT false,
  lead_time_days  INT,                   -- NULL = not disclosed publicly
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INT         NOT NULL DEFAULT 0,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  confidence      NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_vanguard_products_category ON public.vanguard_products(category);
CREATE INDEX IF NOT EXISTS idx_vanguard_products_slug     ON public.vanguard_products(slug);
CREATE INDEX IF NOT EXISTS idx_vanguard_products_active   ON public.vanguard_products(is_active);
CREATE INDEX IF NOT EXISTS idx_vanguard_products_style    ON public.vanguard_products(style);
CREATE INDEX IF NOT EXISTS idx_vanguard_products_mats     ON public.vanguard_products USING GIN(materials);

-- ════════════════════════════════════════════════════════════
-- 3. vanguard_knowledge_relations
--    Directed edges in the knowledge graph:
--    (from_type, from_id) --[relation]--> (to_type, to_id)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vanguard_knowledge_relations (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  from_type     TEXT  NOT NULL,  -- 'material','product','concept','room','process'
  from_id       TEXT  NOT NULL,  -- slug or UUID
  relation_type TEXT  NOT NULL,
  -- 'used_in','compatible_with','part_of','package_includes',
  -- 'requires','alternative_to','incompatible_with','related_to'
  to_type       TEXT  NOT NULL,
  to_id         TEXT  NOT NULL,
  properties    JSONB NOT NULL DEFAULT '{}',  -- optional edge attributes
  confidence    NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  source        TEXT NOT NULL DEFAULT 'manual',  -- 'manual','inferred','admin_correction'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT uq_vanguard_knowledge_relation
    UNIQUE (from_type, from_id, relation_type, to_type, to_id)
);

CREATE INDEX IF NOT EXISTS idx_vanguard_kr_from ON public.vanguard_knowledge_relations(from_type, from_id);
CREATE INDEX IF NOT EXISTS idx_vanguard_kr_to   ON public.vanguard_knowledge_relations(to_type, to_id);
CREATE INDEX IF NOT EXISTS idx_vanguard_kr_rel  ON public.vanguard_knowledge_relations(relation_type);

-- ════════════════════════════════════════════════════════════
-- 4. vanguard_learnings
--    Admin-corrected facts that override LLM outputs (Tier 3).
--    Each row is a verified fact with structured evidence.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vanguard_learnings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain          TEXT        NOT NULL,
  -- 'materials','products','pricing_policy','process','geography',
  -- 'sales_strategy','competitor','general'
  claim           TEXT        NOT NULL,    -- the factual statement
  correction      TEXT,                    -- what the correct answer is (if different from claim)
  evidence        JSONB       NOT NULL DEFAULT '{}',
  -- {"source": "admin", "session_id": "...", "original_wrong_answer": "...", "corrected_by": "admin_user_id"}
  lesson_type     TEXT        NOT NULL DEFAULT 'fact',
  -- 'fact','anti_pattern','heuristic','objection_response','pricing_rule'
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  confidence      NUMERIC(3,2) NOT NULL DEFAULT 0.95 CHECK (confidence BETWEEN 0 AND 1),
  success_count   INT         NOT NULL DEFAULT 0,
  failure_count   INT         NOT NULL DEFAULT 0,
  last_validated  TIMESTAMPTZ,
  created_by      TEXT        NOT NULL DEFAULT 'admin',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_vanguard_learnings_domain   ON public.vanguard_learnings(domain);
CREATE INDEX IF NOT EXISTS idx_vanguard_learnings_active   ON public.vanguard_learnings(is_active);
CREATE INDEX IF NOT EXISTS idx_vanguard_learnings_type     ON public.vanguard_learnings(lesson_type);
CREATE INDEX IF NOT EXISTS idx_vanguard_learnings_conf     ON public.vanguard_learnings(confidence DESC);

-- ════════════════════════════════════════════════════════════
-- 5. vanguard_leads
--    Full CRM pipeline record for every prospect.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vanguard_leads (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            TEXT        NOT NULL UNIQUE,
  stage                 TEXT        NOT NULL DEFAULT 'new',
  -- 'new','qualified','quoted','negotiating','contracted','won','lost'
  tier                  TEXT,        -- 'diamond','gold','silver','bronze'
  score                 INT         NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  room_slug             TEXT,
  material_preferences  TEXT[]      NOT NULL DEFAULT '{}',
  budget_min            NUMERIC(12,2),
  budget_max            NUMERIC(12,2),
  urgency               TEXT,
  -- 'immediate','this_week','this_month','quarter','exploring'
  next_action           TEXT,
  assigned_to           TEXT        NOT NULL DEFAULT 'vanguard',
  probability           NUMERIC(3,2) NOT NULL DEFAULT 0.0 CHECK (probability BETWEEN 0 AND 1),
  predicted_value       NUMERIC(12,2),   -- EGP
  predicted_close_date  DATE,
  risk_factors          JSONB       NOT NULL DEFAULT '[]',
  closed_at             TIMESTAMPTZ,
  notes                 TEXT,
  metadata              JSONB       NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_vanguard_leads_stage     ON public.vanguard_leads(stage);
CREATE INDEX IF NOT EXISTS idx_vanguard_leads_tier      ON public.vanguard_leads(tier);
CREATE INDEX IF NOT EXISTS idx_vanguard_leads_score     ON public.vanguard_leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_vanguard_leads_session   ON public.vanguard_leads(session_id);
CREATE INDEX IF NOT EXISTS idx_vanguard_leads_created   ON public.vanguard_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vanguard_leads_assigned  ON public.vanguard_leads(assigned_to);

-- ════════════════════════════════════════════════════════════
-- 6. vanguard_embeddings
--    pgvector store for semantic search across all entity types.
--    Uses 768-dim embeddings (Hugging Face free-tier compatible)
--    with fallback support for 1536 (OpenAI) stored as JSONB.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vanguard_embeddings (
  id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    TEXT     NOT NULL,
  -- 'material','product','learning','memory','lead','belief','document'
  entity_id      TEXT     NOT NULL,   -- UUID or slug of the parent record
  chunk_index    INT      NOT NULL DEFAULT 0,  -- for multi-chunk documents
  content        TEXT     NOT NULL,   -- the text that was embedded
  embedding      VECTOR(768) NOT NULL,
  -- Metadata for hybrid keyword search
  tags           TEXT[]   NOT NULL DEFAULT '{}',
  language       TEXT     NOT NULL DEFAULT 'ar',
  importance     NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  access_count   INT      NOT NULL DEFAULT 0,
  last_accessed  TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,         -- NULL = never expires
  created_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT uq_vanguard_embedding UNIQUE (entity_type, entity_id, chunk_index)
);

-- HNSW index for fast approximate nearest-neighbor (cosine distance)
CREATE INDEX IF NOT EXISTS idx_vanguard_embeddings_hnsw
  ON public.vanguard_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_vanguard_embeddings_entity ON public.vanguard_embeddings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_vanguard_embeddings_tags   ON public.vanguard_embeddings USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_vanguard_embeddings_lang   ON public.vanguard_embeddings(language);

-- ════════════════════════════════════════════════════════════
-- 7. vanguard_consciousness_state
--    Persisted snapshot of ConsciousnessCore state.
--    One row per identity (upsert on identity_key).
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vanguard_consciousness_state (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_key  TEXT        NOT NULL UNIQUE,  -- e.g. 'vanguard-v1'
  state_name    TEXT        NOT NULL DEFAULT 'dormant',
  goals         JSONB       NOT NULL DEFAULT '{}',
  root_goal_ids TEXT[]      NOT NULL DEFAULT '{}',
  beliefs       JSONB       NOT NULL DEFAULT '{}',
  context       JSONB       NOT NULL DEFAULT '{}',
  attention_focus TEXT,
  metrics       JSONB       NOT NULL DEFAULT '{}',
  decision_history JSONB    NOT NULL DEFAULT '[]',
  cycle_count   INT         NOT NULL DEFAULT 0,
  last_cycle_at TIMESTAMPTZ,
  snapshotted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ════════════════════════════════════════════════════════════
-- 8. vanguard_background_tasks
--    Job queue for the swarm agents (15+ workers).
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vanguard_background_tasks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name      TEXT        NOT NULL,
  task_type       TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',
  -- 'pending','running','completed','failed','scheduled','cancelled'
  priority        INT         NOT NULL DEFAULT 50,   -- 0 (low) → 100 (critical)
  payload         JSONB       NOT NULL DEFAULT '{}',
  result          JSONB,
  error_message   TEXT,
  retry_count     INT         NOT NULL DEFAULT 0,
  max_retries     INT         NOT NULL DEFAULT 3,
  idempotency_key TEXT        UNIQUE,   -- prevents duplicate execution
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  scheduled_for   TIMESTAMPTZ,
  recurring       BOOLEAN     NOT NULL DEFAULT false,
  cron_expression TEXT,
  timeout_ms      INT         NOT NULL DEFAULT 30000,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_vanguard_bg_status     ON public.vanguard_background_tasks(status);
CREATE INDEX IF NOT EXISTS idx_vanguard_bg_agent      ON public.vanguard_background_tasks(agent_name);
CREATE INDEX IF NOT EXISTS idx_vanguard_bg_scheduled  ON public.vanguard_background_tasks(scheduled_for ASC NULLS LAST)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_vanguard_bg_pending    ON public.vanguard_background_tasks(priority DESC, created_at ASC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_vanguard_bg_idem       ON public.vanguard_background_tasks(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ════════════════════════════════════════════════════════════
-- 9. vanguard_evolution_history
--    Audit log of every self-improvement cycle.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vanguard_evolution_history (
  id                   UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type         TEXT   NOT NULL,
  -- 'scheduled','performance_threshold','error_threshold','manual'
  changes              JSONB  NOT NULL DEFAULT '[]',
  strategy_updates     JSONB  NOT NULL DEFAULT '[]',
  new_capabilities     TEXT[] NOT NULL DEFAULT '{}',
  performance_before   JSONB  NOT NULL DEFAULT '{}',
  performance_after    JSONB  NOT NULL DEFAULT '{}',
  rollback_performed   BOOLEAN NOT NULL DEFAULT false,
  rollback_reason      TEXT,
  status               TEXT   NOT NULL DEFAULT 'completed',
  -- 'completed','rolled_back','failed'
  ab_test_id           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_vanguard_evo_trigger ON public.vanguard_evolution_history(trigger_type);
CREATE INDEX IF NOT EXISTS idx_vanguard_evo_status  ON public.vanguard_evolution_history(status);
CREATE INDEX IF NOT EXISTS idx_vanguard_evo_created ON public.vanguard_evolution_history(created_at DESC);

-- ════════════════════════════════════════════════════════════
-- 10. vanguard_api_usage
--     Every external API call logged for cost accountability.
--     Target: prove $0/month operational cost.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vanguard_api_usage (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name     TEXT    NOT NULL,   -- 'groq','gemini','huggingface','serpstack','supabase'
  endpoint     TEXT    NOT NULL,
  method       TEXT    NOT NULL DEFAULT 'POST',
  status_code  INT,
  latency_ms   INT,
  tokens_used  INT,
  cost_usd     NUMERIC(10,8) NOT NULL DEFAULT 0,  -- always 0 for free-tier APIs
  model        TEXT,
  session_id   TEXT,
  error        TEXT,
  metadata     JSONB   NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Partition-friendly index: query by day for cost dashboard
CREATE INDEX IF NOT EXISTS idx_vanguard_api_usage_date    ON public.vanguard_api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vanguard_api_usage_api     ON public.vanguard_api_usage(api_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vanguard_api_usage_session ON public.vanguard_api_usage(session_id)
  WHERE session_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════
-- 11. vanguard_verification_log
--     Citation audit trail: every claim the system verified
--     and which tier it used.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vanguard_verification_log (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   TEXT    NOT NULL,
  claim        TEXT    NOT NULL,
  tier_used    TEXT    NOT NULL,   -- 'tier1','tier2','tier3','failed'
  verified     BOOLEAN NOT NULL,
  confidence   NUMERIC(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  citations    JSONB   NOT NULL DEFAULT '[]',
  -- Array of Citation objects {id, tier, source, excerpt, claim, confidence, verifiedAt}
  latency_ms   INT,
  failure_reason TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_vanguard_vlog_session  ON public.vanguard_verification_log(session_id);
CREATE INDEX IF NOT EXISTS idx_vanguard_vlog_tier     ON public.vanguard_verification_log(tier_used);
CREATE INDEX IF NOT EXISTS idx_vanguard_vlog_verified ON public.vanguard_verification_log(verified);
CREATE INDEX IF NOT EXISTS idx_vanguard_vlog_created  ON public.vanguard_verification_log(created_at DESC);

-- ════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGERS
-- ════════════════════════════════════════════════════════════
DO $$ BEGIN
  -- vanguard_materials
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vanguard_materials_updated_at') THEN
    CREATE TRIGGER trg_vanguard_materials_updated_at
      BEFORE UPDATE ON public.vanguard_materials
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  -- vanguard_products
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vanguard_products_updated_at') THEN
    CREATE TRIGGER trg_vanguard_products_updated_at
      BEFORE UPDATE ON public.vanguard_products
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  -- vanguard_learnings
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vanguard_learnings_updated_at') THEN
    CREATE TRIGGER trg_vanguard_learnings_updated_at
      BEFORE UPDATE ON public.vanguard_learnings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  -- vanguard_leads
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vanguard_leads_updated_at') THEN
    CREATE TRIGGER trg_vanguard_leads_updated_at
      BEFORE UPDATE ON public.vanguard_leads
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  -- vanguard_consciousness_state
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vanguard_consciousness_updated_at') THEN
    CREATE TRIGGER trg_vanguard_consciousness_updated_at
      BEFORE UPDATE ON public.vanguard_consciousness_state
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  -- vanguard_background_tasks
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vanguard_bg_tasks_updated_at') THEN
    CREATE TRIGGER trg_vanguard_bg_tasks_updated_at
      BEFORE UPDATE ON public.vanguard_background_tasks
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.vanguard_materials          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_knowledge_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_learnings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_embeddings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_consciousness_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_background_tasks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_evolution_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_api_usage          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_verification_log   ENABLE ROW LEVEL SECURITY;

-- Service role: unrestricted access (used by the Next.js backend only)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_materials' AND policyname = 'vanguard_service_materials') THEN
    CREATE POLICY vanguard_service_materials          ON public.vanguard_materials          FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_products' AND policyname = 'vanguard_service_products') THEN
    CREATE POLICY vanguard_service_products           ON public.vanguard_products           FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_knowledge_relations' AND policyname = 'vanguard_service_kr') THEN
    CREATE POLICY vanguard_service_kr                 ON public.vanguard_knowledge_relations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_learnings' AND policyname = 'vanguard_service_learnings') THEN
    CREATE POLICY vanguard_service_learnings          ON public.vanguard_learnings          FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_leads' AND policyname = 'vanguard_service_leads') THEN
    CREATE POLICY vanguard_service_leads              ON public.vanguard_leads              FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_embeddings' AND policyname = 'vanguard_service_embeddings') THEN
    CREATE POLICY vanguard_service_embeddings         ON public.vanguard_embeddings         FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_consciousness_state' AND policyname = 'vanguard_service_consciousness') THEN
    CREATE POLICY vanguard_service_consciousness      ON public.vanguard_consciousness_state FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_background_tasks' AND policyname = 'vanguard_service_bg') THEN
    CREATE POLICY vanguard_service_bg                 ON public.vanguard_background_tasks   FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_evolution_history' AND policyname = 'vanguard_service_evo') THEN
    CREATE POLICY vanguard_service_evo                ON public.vanguard_evolution_history  FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_api_usage' AND policyname = 'vanguard_service_api_usage') THEN
    CREATE POLICY vanguard_service_api_usage          ON public.vanguard_api_usage          FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_verification_log' AND policyname = 'vanguard_service_vlog') THEN
    CREATE POLICY vanguard_service_vlog               ON public.vanguard_verification_log   FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Authenticated users can read public knowledge (materials, products, knowledge_relations)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_materials' AND policyname = 'vanguard_read_materials') THEN
    CREATE POLICY vanguard_read_materials ON public.vanguard_materials
      FOR SELECT TO authenticated USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_products' AND policyname = 'vanguard_read_products') THEN
    CREATE POLICY vanguard_read_products ON public.vanguard_products
      FOR SELECT TO authenticated USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_knowledge_relations' AND policyname = 'vanguard_read_kr') THEN
    CREATE POLICY vanguard_read_kr ON public.vanguard_knowledge_relations
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ════════════════════════════════════════════════════════════

-- Hybrid search: vector similarity + keyword match, returns top-k rows
CREATE OR REPLACE FUNCTION public.vanguard_hybrid_search(
  query_embedding VECTOR(768),
  query_text      TEXT,
  entity_filter   TEXT    DEFAULT NULL,   -- filter by entity_type (NULL = all)
  match_count     INT     DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id          UUID,
  entity_type TEXT,
  entity_id   TEXT,
  content     TEXT,
  tags        TEXT[],
  similarity  FLOAT,
  rank        FLOAT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    e.id,
    e.entity_type,
    e.entity_id,
    e.content,
    e.tags,
    1 - (e.embedding <=> query_embedding) AS similarity,
    -- Combined rank: 70% vector similarity + 30% keyword match
    (0.7 * (1 - (e.embedding <=> query_embedding))) +
    (0.3 * ts_rank(to_tsvector('arabic', e.content), plainto_tsquery('arabic', query_text))) AS rank
  FROM public.vanguard_embeddings e
  WHERE
    (entity_filter IS NULL OR e.entity_type = entity_filter)
    AND (1 - (e.embedding <=> query_embedding)) > similarity_threshold
    AND (e.expires_at IS NULL OR e.expires_at > now())
  ORDER BY rank DESC
  LIMIT match_count;
$$;

-- Upsert consciousness state (single-row per identity)
CREATE OR REPLACE FUNCTION public.vanguard_upsert_consciousness(
  p_identity_key   TEXT,
  p_state_name     TEXT,
  p_goals          JSONB,
  p_root_goal_ids  TEXT[],
  p_beliefs        JSONB,
  p_context        JSONB,
  p_attention_focus TEXT,
  p_metrics        JSONB,
  p_decision_history JSONB,
  p_cycle_count    INT
)
RETURNS UUID LANGUAGE PLPGSQL AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.vanguard_consciousness_state (
    identity_key, state_name, goals, root_goal_ids, beliefs, context,
    attention_focus, metrics, decision_history, cycle_count, last_cycle_at, snapshotted_at
  ) VALUES (
    p_identity_key, p_state_name, p_goals, p_root_goal_ids, p_beliefs, p_context,
    p_attention_focus, p_metrics, p_decision_history, p_cycle_count, now(), now()
  )
  ON CONFLICT (identity_key) DO UPDATE SET
    state_name       = EXCLUDED.state_name,
    goals            = EXCLUDED.goals,
    root_goal_ids    = EXCLUDED.root_goal_ids,
    beliefs          = EXCLUDED.beliefs,
    context          = EXCLUDED.context,
    attention_focus  = EXCLUDED.attention_focus,
    metrics          = EXCLUDED.metrics,
    decision_history = EXCLUDED.decision_history,
    cycle_count      = EXCLUDED.cycle_count,
    last_cycle_at    = now(),
    snapshotted_at   = now(),
    updated_at       = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- COMMENTS (documentation in DB)
-- ════════════════════════════════════════════════════════════
COMMENT ON TABLE public.vanguard_materials          IS 'Knowledge base: wood species, metals, fabrics — Tier 1 citation source';
COMMENT ON TABLE public.vanguard_products           IS 'Finished goods catalog for the showroom — Tier 1 citation source';
COMMENT ON TABLE public.vanguard_knowledge_relations IS 'Directed knowledge graph edges between entities';
COMMENT ON TABLE public.vanguard_learnings          IS 'Admin-verified facts (Tier 3) that override LLM guesses';
COMMENT ON TABLE public.vanguard_leads              IS 'Full CRM pipeline: from new visitor to won/lost deal';
COMMENT ON TABLE public.vanguard_embeddings         IS 'pgvector HNSW semantic memory — 768-dim, hybrid search enabled';
COMMENT ON TABLE public.vanguard_consciousness_state IS 'Persisted ConsciousnessCore snapshot — survives cold starts';
COMMENT ON TABLE public.vanguard_background_tasks   IS 'Swarm agent job queue with idempotency, retries, and scheduling';
COMMENT ON TABLE public.vanguard_evolution_history  IS 'Audit log of every self-improvement and A/B evolution cycle';
COMMENT ON TABLE public.vanguard_api_usage          IS 'Every external API call — proves $0/month operational cost';
COMMENT ON TABLE public.vanguard_verification_log   IS 'Citation audit: which tier verified which claim per session';
