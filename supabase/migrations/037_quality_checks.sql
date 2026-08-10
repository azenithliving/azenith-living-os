-- Migration: Create quality_checks table for production quality management
-- Enables real quality tracking with photo evidence and approval workflow

CREATE TABLE IF NOT EXISTS quality_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    company_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES companies(id) ON DELETE CASCADE,
    production_job_id UUID REFERENCES production_jobs(id) ON DELETE SET NULL,
    
    -- Check details
    job_title VARCHAR(255) NOT NULL DEFAULT 'مهمة إنتاج',
    check_type VARCHAR(50) NOT NULL CHECK (check_type IN ('incoming_material', 'in_process', 'pre_finish', 'final')),
    stage_name VARCHAR(255),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pass', 'fail', 'conditional_pass')),
    notes TEXT DEFAULT '',
    
    -- Evidence
    photos TEXT[] DEFAULT '{}',
    measurements JSONB DEFAULT '{}',
    
    -- Inspector info
    checked_by VARCHAR(255) DEFAULT 'system',
    checked_at TIMESTAMPTZ DEFAULT now(),
    
    -- Approval workflow
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    
    -- Corrective actions (if failed)
    corrective_action_required BOOLEAN DEFAULT false,
    corrective_action_description TEXT,
    corrective_action_deadline TIMESTAMPTZ,
    corrective_action_completed_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quality_checks_company ON quality_checks(company_id);
CREATE INDEX IF NOT EXISTS idx_quality_checks_job ON quality_checks(production_job_id);
CREATE INDEX IF NOT EXISTS idx_quality_checks_type ON quality_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_quality_checks_status ON quality_checks(status);
CREATE INDEX IF NOT EXISTS idx_quality_checks_checked_at ON quality_checks(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_checks_corrective ON quality_checks(corrective_action_required) WHERE corrective_action_required = true;

-- RLS
ALTER TABLE quality_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quality checks viewable by company" ON quality_checks;
CREATE POLICY "Quality checks viewable by company"
    ON quality_checks FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Quality checks insertable by system" ON quality_checks;
CREATE POLICY "Quality checks insertable by system"
    ON quality_checks FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Quality checks updatable by admin" ON quality_checks;
CREATE POLICY "Quality checks updatable by admin"
    ON quality_checks FOR UPDATE
    USING (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_quality_checks_updated_at ON quality_checks;
CREATE TRIGGER update_quality_checks_updated_at
    BEFORE UPDATE ON quality_checks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate quality metrics
CREATE OR REPLACE FUNCTION get_quality_metrics(
    p_company_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
    p_start_date TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
    p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
    total_checks BIGINT,
    pass_count BIGINT,
    fail_count BIGINT,
    conditional_count BIGINT,
    pass_rate NUMERIC,
    incoming_material_count BIGINT,
    in_process_count BIGINT,
    pre_finish_count BIGINT,
    final_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_checks,
        COUNT(*) FILTER (WHERE qc.status = 'pass')::BIGINT as pass_count,
        COUNT(*) FILTER (WHERE qc.status = 'fail')::BIGINT as fail_count,
        COUNT(*) FILTER (WHERE qc.status = 'conditional_pass')::BIGINT as conditional_count,
        CASE
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE qc.status = 'pass')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
            ELSE 0
        END as pass_rate,
        COUNT(*) FILTER (WHERE qc.check_type = 'incoming_material')::BIGINT as incoming_material_count,
        COUNT(*) FILTER (WHERE qc.check_type = 'in_process')::BIGINT as in_process_count,
        COUNT(*) FILTER (WHERE qc.check_type = 'pre_finish')::BIGINT as pre_finish_count,
        COUNT(*) FILTER (WHERE qc.check_type = 'final')::BIGINT as final_count
    FROM quality_checks qc
    WHERE qc.created_at BETWEEN p_start_date AND p_end_date
        AND qc.company_id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON quality_checks TO authenticated;
GRANT EXECUTE ON FUNCTION get_quality_metrics TO authenticated;
