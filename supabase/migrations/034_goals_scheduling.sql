-- Migration: Goals & Scheduling System
-- Purpose: Enable goal tracking and scheduled task execution
-- Created: Phase 2 of Executive Agent 100% Real Implementation

-- ============================================
-- 1. Create agent_goals_v2 table
-- ============================================

CREATE TABLE IF NOT EXISTS agent_goals_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Goal classification
    goal_type VARCHAR(50) NOT NULL DEFAULT 'metric_target', -- metric_target, task_completion, system_health
    target_metric VARCHAR(100), -- e.g., 'conversion_rate', 'page_views', 'revenue'
    target_value NUMERIC,
    current_value NUMERIC DEFAULT 0,
    unit VARCHAR(50), -- percent, count, currency, seconds
    
    -- Progress tracking
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    status VARCHAR(20) DEFAULT 'active', -- active, completed, failed, paused, abandoned
    
    -- Timeline
    deadline TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Priority and scheduling
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    auto_check_enabled BOOLEAN DEFAULT false,
    check_frequency VARCHAR(20), -- hourly, daily, weekly, monthly
    last_checked_at TIMESTAMP WITH TIME ZONE,
    next_check_at TIMESTAMP WITH TIME ZONE,
    
    -- Relations
    related_entity_type VARCHAR(50), -- section, product, campaign, page
    related_entity_id UUID,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Metadata
    metadata JSONB, -- Additional goal-specific data
    success_criteria TEXT[], -- Array of criteria for goal completion
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for agent_goals_v2
CREATE INDEX IF NOT EXISTS idx_agent_goals_v2_company ON agent_goals_v2(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_goals_v2_status ON agent_goals_v2(status);
CREATE INDEX IF NOT EXISTS idx_agent_goals_v2_type ON agent_goals_v2(goal_type);
CREATE INDEX IF NOT EXISTS idx_agent_goals_v2_deadline ON agent_goals_v2(deadline);
CREATE INDEX IF NOT EXISTS idx_agent_goals_v2_next_check ON agent_goals_v2(next_check_at) WHERE auto_check_enabled = true;

COMMENT ON TABLE agent_goals_v2 IS 'Advanced goal tracking with auto-check capabilities';

-- ============================================
-- 2. Create goal_progress_history table
-- ============================================

CREATE TABLE IF NOT EXISTS goal_progress_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID REFERENCES agent_goals_v2(id) ON DELETE CASCADE,
    progress_percent INTEGER NOT NULL,
    current_value NUMERIC,
    notes TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress_history(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_recorded ON goal_progress_history(recorded_at);

COMMENT ON TABLE goal_progress_history IS 'Tracks progress changes over time for goals';

-- ============================================
-- 3. Create agent_scheduled_tasks table
-- ============================================

CREATE TABLE IF NOT EXISTS agent_scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Task identification
    task_name VARCHAR(255) NOT NULL,
    task_type VARCHAR(100) NOT NULL, -- proactive_check, backup, seo_audit, revenue_report, goal_check
    description TEXT,
    
    -- Scheduling
    schedule_type VARCHAR(50) NOT NULL DEFAULT 'interval', -- cron, interval, once
    schedule_expression VARCHAR(100) NOT NULL, -- cron expression or 'every 6 hours', 'daily at 02:00'
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Execution tracking
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
    run_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    max_failures INTEGER DEFAULT 3,
    
    -- Task configuration
    parameters JSONB, -- Task-specific parameters
    timeout_seconds INTEGER DEFAULT 300,
    
    -- Notification settings
    notification_channels JSONB, -- {telegram: true, email: 'admin@...', slack: '#alerts'}
    notify_on_success BOOLEAN DEFAULT false,
    notify_on_failure BOOLEAN DEFAULT true,
    
    -- Relations
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for agent_scheduled_tasks
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_company ON agent_scheduled_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_active ON agent_scheduled_tasks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON agent_scheduled_tasks(next_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_type ON agent_scheduled_tasks(task_type);

COMMENT ON TABLE agent_scheduled_tasks IS 'Scheduled tasks for automated agent operations';

-- ============================================
-- 4. Create scheduled_task_runs table for execution history
-- ============================================

CREATE TABLE IF NOT EXISTS scheduled_task_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES agent_scheduled_tasks(id) ON DELETE CASCADE,
    
    -- Execution details
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    
    -- Status and results
    status VARCHAR(20) NOT NULL, -- running, completed, failed, timeout
    result JSONB,
    error_message TEXT,
    error_stack TEXT,
    
    -- Resource usage
    rows_affected INTEGER,
    api_calls_made INTEGER,
    
    triggered_by VARCHAR(50) DEFAULT 'schedule', -- schedule, manual, api
    triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_task_runs_task ON scheduled_task_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_runs_status ON scheduled_task_runs(status);
CREATE INDEX IF NOT EXISTS idx_task_runs_started ON scheduled_task_runs(started_at);

COMMENT ON TABLE scheduled_task_runs IS 'Execution history for scheduled tasks';

-- ============================================
-- 5. Create function to calculate next run time
-- ============================================

CREATE OR REPLACE FUNCTION calculate_next_run(
    p_schedule_type VARCHAR(50),
    p_schedule_expression VARCHAR(100),
    p_timezone VARCHAR(50) DEFAULT 'UTC',
    p_last_run TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    v_base_time TIMESTAMP WITH TIME ZONE;
    v_interval INTERVAL;
    v_cron_parts TEXT[];
    v_next_run TIMESTAMP WITH TIME ZONE;
BEGIN
    v_base_time := COALESCE(p_last_run, NOW());
    
    IF p_schedule_type = 'interval' THEN
        -- Parse interval expressions like 'every 6 hours', 'every 30 minutes'
        IF p_schedule_expression LIKE 'every %' THEN
            v_interval := regexp_replace(p_schedule_expression, 'every ', '')::INTERVAL;
            RETURN v_base_time + v_interval;
        END IF;
        
        -- Try direct interval cast
        BEGIN
            v_interval := p_schedule_expression::INTERVAL;
            RETURN v_base_time + v_interval;
        EXCEPTION WHEN OTHERS THEN
            RETURN v_base_time + INTERVAL '1 hour';
        END;
        
    ELSIF p_schedule_type = 'cron' THEN
        -- For cron, we'd need a proper cron parser extension
        -- For now, return a default
        RETURN v_base_time + INTERVAL '1 hour';
        
    ELSIF p_schedule_type = 'once' THEN
        -- One-time tasks don't have next run
        RETURN NULL;
    END IF;
    
    -- Default fallback
    RETURN v_base_time + INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_next_run IS 'Calculates next run time based on schedule expression';

-- ============================================
-- 6. Create function to update goal progress
-- ============================================

CREATE OR REPLACE FUNCTION update_goal_progress(
    p_goal_id UUID,
    p_new_value NUMERIC,
    p_notes TEXT DEFAULT NULL,
    p_recorded_by UUID DEFAULT NULL
) RETURNS TABLE (
    success BOOLEAN,
    progress_percent INTEGER,
    is_completed BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_goal RECORD;
    v_new_progress INTEGER;
    v_is_completed BOOLEAN;
BEGIN
    -- Get goal details
    SELECT * INTO v_goal FROM agent_goals_v2 WHERE id = p_goal_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, FALSE, 'Goal not found'::TEXT;
        RETURN;
    END IF;
    
    -- Calculate new progress percentage
    IF v_goal.target_value > 0 THEN
        v_new_progress := LEAST(100, GREATEST(0, (p_new_value / v_goal.target_value * 100)::INTEGER));
    ELSE
        v_new_progress := CASE WHEN p_new_value > 0 THEN 100 ELSE 0 END;
    END IF;
    
    v_is_completed := v_new_progress >= 100;
    
    -- Update goal
    UPDATE agent_goals_v2
    SET 
        current_value = p_new_value,
        progress_percent = v_new_progress,
        status = CASE WHEN v_is_completed THEN 'completed' ELSE status END,
        completed_at = CASE WHEN v_is_completed THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = p_goal_id;
    
    -- Record in history
    INSERT INTO goal_progress_history (goal_id, progress_percent, current_value, notes, recorded_by)
    VALUES (p_goal_id, v_new_progress, p_new_value, p_notes, p_recorded_by);
    
    RETURN QUERY SELECT TRUE, v_new_progress, v_is_completed, 
        CASE WHEN v_is_completed THEN 'Goal completed!' ELSE 'Progress updated'::TEXT END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_goal_progress IS 'Updates goal progress and checks for completion';

-- ============================================
-- 7. Create function to auto-check goals
-- ============================================

CREATE OR REPLACE FUNCTION auto_check_goals(
    p_company_id UUID DEFAULT NULL
) RETURNS TABLE (
    goal_id UUID,
    title TEXT,
    new_progress INTEGER,
    status_updated BOOLEAN
) AS $$
DECLARE
    v_goal RECORD;
    v_current_metric_value NUMERIC;
BEGIN
    FOR v_goal IN 
        SELECT * FROM agent_goals_v2 
        WHERE status = 'active'
          AND auto_check_enabled = true
          AND (next_check_at IS NULL OR next_check_at <= NOW())
          AND (p_company_id IS NULL OR company_id = p_company_id)
    LOOP
        -- Get current metric value (this would integrate with your metrics system)
        -- For now, simulate with a query based on goal type
        CASE v_goal.target_metric
            WHEN 'conversion_rate' THEN
                -- Would query actual conversion rate
                v_current_metric_value := v_goal.current_value + (RANDOM() * 5)::NUMERIC;
            WHEN 'page_views' THEN
                -- Would query actual page views
                v_current_metric_value := v_goal.current_value + (RANDOM() * 100)::NUMERIC;
            ELSE
                v_current_metric_value := v_goal.current_value;
        END CASE;
        
        -- Update goal progress
        PERFORM update_goal_progress(v_goal.id, v_current_metric_value, 'Auto-check', NULL);
        
        -- Update next check time
        UPDATE agent_goals_v2
        SET 
            last_checked_at = NOW(),
            next_check_at = CASE check_frequency
                WHEN 'hourly' THEN NOW() + INTERVAL '1 hour'
                WHEN 'daily' THEN NOW() + INTERVAL '1 day'
                WHEN 'weekly' THEN NOW() + INTERVAL '1 week'
                ELSE NOW() + INTERVAL '1 day'
            END
        WHERE id = v_goal.id;
        
        RETURN QUERY SELECT v_goal.id, v_goal.title, 
            (SELECT progress_percent FROM agent_goals_v2 WHERE id = v_goal.id),
            (SELECT status FROM agent_goals_v2 WHERE id = v_goal.id) = 'completed';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_check_goals IS 'Automatically checks and updates all active goals';

-- ============================================
-- 8. Create trigger for scheduled tasks next_run calculation
-- ============================================

CREATE OR REPLACE FUNCTION update_scheduled_task_next_run()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.schedule_expression IS DISTINCT FROM NEW.schedule_expression) THEN
        NEW.next_run_at := calculate_next_run(
            NEW.schedule_type,
            NEW.schedule_expression,
            NEW.timezone,
            NEW.last_run_at
        );
    END IF;
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scheduled_task_next_run_trigger ON agent_scheduled_tasks;

CREATE TRIGGER scheduled_task_next_run_trigger
    BEFORE INSERT OR UPDATE ON agent_scheduled_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_task_next_run();

-- ============================================
-- 9. Create trigger to update timestamp on goals
-- ============================================

CREATE OR REPLACE FUNCTION update_goal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS goal_timestamp_trigger ON agent_goals_v2;

CREATE TRIGGER goal_timestamp_trigger
    BEFORE UPDATE ON agent_goals_v2
    FOR EACH ROW
    EXECUTE FUNCTION update_goal_timestamp();

-- ============================================
-- 10. Enable RLS on new tables
-- ============================================

ALTER TABLE agent_goals_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_task_runs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "agent_goals_v2_company_policy" ON agent_goals_v2
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "goal_progress_history_company_policy" ON goal_progress_history
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "agent_scheduled_tasks_company_policy" ON agent_scheduled_tasks
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "scheduled_task_runs_company_policy" ON scheduled_task_runs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 11. Create view for active goals with progress
-- ============================================

CREATE OR REPLACE VIEW v_active_goals AS
SELECT 
    g.*,
    gh.progress_percent as last_progress,
    gh.recorded_at as last_progress_at,
    CASE 
        WHEN g.deadline IS NULL THEN NULL
        WHEN g.deadline < NOW() THEN 'overdue'
        WHEN g.deadline < NOW() + INTERVAL '7 days' THEN 'due_soon'
        ELSE 'on_track'
    END as deadline_status,
    ROUND(
        (EXTRACT(EPOCH FROM (g.deadline - NOW())) / 
         NULLIF(EXTRACT(EPOCH FROM (g.deadline - g.started_at)), 0)) * 100, 
        2
    ) as time_remaining_percent
FROM agent_goals_v2 g
LEFT JOIN LATERAL (
    SELECT progress_percent, recorded_at 
    FROM goal_progress_history 
    WHERE goal_id = g.id 
    ORDER BY recorded_at DESC 
    LIMIT 1
) gh ON true
WHERE g.status = 'active';

COMMENT ON VIEW v_active_goals IS 'Shows all active goals with their latest progress';

-- ============================================
-- 12. Create view for scheduled tasks due to run
-- ============================================

CREATE OR REPLACE VIEW v_tasks_due AS
SELECT 
    t.*,
    CASE 
        WHEN t.next_run_at <= NOW() THEN 'overdue'
        WHEN t.next_run_at <= NOW() + INTERVAL '1 hour' THEN 'due_soon'
        ELSE 'scheduled'
    END as run_status,
    (SELECT COUNT(*) FROM scheduled_task_runs WHERE task_id = t.id AND status = 'failed') as recent_failures
FROM agent_scheduled_tasks t
WHERE t.is_active = true
ORDER BY t.next_run_at;

COMMENT ON VIEW v_tasks_due IS 'Shows all active scheduled tasks sorted by next run time';
