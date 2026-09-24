-- P0 Day of Truth: sync events bus table
-- Contract mirrors lib/qayyim/memory/SyncLayer.ts:
--   publish() inserts {company_id, event_type, source_agent, target_agents, payload}
--   processNewEvents() pages with gt('id', lastId) + order created_at asc limit 50
-- id is bigint identity so PostgREST returns it as a plain monotonic number (gt paging safe).

CREATE TABLE IF NOT EXISTS public.qayyim_sync_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source_agent TEXT NOT NULL,
  target_agents JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qayyim_sync_events_company_id ON public.qayyim_sync_events(company_id, id);
CREATE INDEX IF NOT EXISTS idx_qayyim_sync_events_company_created ON public.qayyim_sync_events(company_id, created_at);

ALTER TABLE public.qayyim_sync_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_qayyim_sync_events" ON public.qayyim_sync_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
