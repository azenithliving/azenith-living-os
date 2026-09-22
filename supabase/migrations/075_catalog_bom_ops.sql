-- Catalog BOM templates used by PRIME chat (imperial salon and similar products).
-- Extends existing bom_headers / bom_items so calculations persist in Postgres.

ALTER TABLE bom_headers
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS product_slug TEXT,
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bom_headers_company_slug
  ON bom_headers (company_id, product_slug)
  WHERE is_template = true;

ALTER TABLE production_jobs
  ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS unit_of_measure TEXT;

UPDATE inventory_items
SET unit_of_measure = unit
WHERE unit_of_measure IS NULL AND unit IS NOT NULL;

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_conversations' AND policyname = 'service_role_agent_conversations'
  ) THEN
    CREATE POLICY service_role_agent_conversations ON agent_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_messages' AND policyname = 'service_role_agent_messages'
  ) THEN
    CREATE POLICY service_role_agent_messages ON agent_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bom_headers' AND policyname = 'service_role_bom_headers'
  ) THEN
    CREATE POLICY service_role_bom_headers ON bom_headers FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bom_items' AND policyname = 'service_role_bom_items'
  ) THEN
    CREATE POLICY service_role_bom_items ON bom_items FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'production_jobs' AND policyname = 'service_role_production_jobs'
  ) THEN
    CREATE POLICY service_role_production_jobs ON production_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_items' AND policyname = 'service_role_inventory_items'
  ) THEN
    CREATE POLICY service_role_inventory_items ON inventory_items FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
