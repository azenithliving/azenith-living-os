-- P0 Day of Truth: visitor telemetry table
-- Contract mirrors app/api/telemetry/route.ts (edge runtime upsert by session_id).

CREATE TABLE IF NOT EXISTS public.visitor_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  current_path TEXT,
  hovered_elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  attention_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_telemetry_session_id ON public.visitor_telemetry(session_id);

ALTER TABLE public.visitor_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_visitor_telemetry" ON public.visitor_telemetry
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_visitor_telemetry_updated_at
  BEFORE UPDATE ON public.visitor_telemetry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
