-- Migration: the execution ledger the unified tool door writes its first row into.
--
-- Measured live 2026-10-19: POST /api/admin/agent/tools/execute refused every tool with
-- «Failed to create execution record: Could not find the table 'agent_executions'». The table was
-- written about in supabase/migrations/031_agent_execution_tables.sql, which was never applied — and
-- that file also creates four other tables, among them `site_sections`, the one the owner's
-- section-preview decision is about. So this file narrows it to the single ledger the door needs.
--
-- Two differences from 031, both forced by the code that writes here:
--   * `execution_id` exists. lib/agent-tools/execution-tracker.ts stamps the caller's own id on the
--     row; without the column the insert fails with a different missing-column error.
--   * No foreign key to `general_suggestions`. That table does not exist in the record either, so the
--     constraint would make this whole migration fail. `suggestion_id` stays a plain uuid.
--
-- RLS is enabled with zero policies: the record answers to the store's own credential only
-- (measured 2026-10-15), and a door that writes here arrives with that credential.

CREATE TABLE IF NOT EXISTS agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The caller's own id, stamped by the tracker before the tool runs.
    execution_id TEXT,

    -- Relations for traceability.
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    command_log_id TEXT,
    suggestion_id UUID,

    -- Execution metadata.
    execution_type VARCHAR(50) NOT NULL,
    execution_data JSONB NOT NULL DEFAULT '{}',
    execution_result JSONB,
    execution_status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- Performance tracking.
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    execution_time_ms INTEGER,

    -- Error handling.
    error_message TEXT,
    error_stack TEXT,

    -- Impact tracking.
    affected_rows INTEGER DEFAULT 0,
    affected_tables TEXT[],
    rollback_available BOOLEAN DEFAULT false,

    -- Audit.
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_executions_company_id ON agent_executions(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_actor_user_id ON agent_executions(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(execution_status);
CREATE INDEX IF NOT EXISTS idx_agent_executions_type ON agent_executions(execution_type);
CREATE INDEX IF NOT EXISTS idx_agent_executions_created_at ON agent_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_executions_execution_id ON agent_executions(execution_id);

CREATE OR REPLACE FUNCTION update_agent_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_executions_updated_at ON agent_executions;
CREATE TRIGGER trg_agent_executions_updated_at
    BEFORE UPDATE ON agent_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_executions_updated_at();

ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
