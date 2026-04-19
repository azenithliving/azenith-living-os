-- Migration: Content Update Support
-- Purpose: Enable real content updates with revision tracking
-- Created: Phase 2 of Executive Agent 100% Real Implementation

-- ============================================
-- 1. Enhance content_revisions table
-- ============================================

-- Add columns for better content tracking
ALTER TABLE content_revisions 
ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) NOT NULL DEFAULT 'site_section',
ADD COLUMN IF NOT EXISTS content_id UUID,
ADD COLUMN IF NOT EXISTS field_path TEXT[], -- For nested field paths like ['content', 'body', 'title']
ADD COLUMN IF NOT EXISTS diff_json JSONB; -- Enhanced diff representation

-- Add comments for documentation
COMMENT ON COLUMN content_revisions.content_type IS 'Type of content: site_section, room, product, blog_post, page';
COMMENT ON COLUMN content_revisions.content_id IS 'ID of the content entity being modified';
COMMENT ON COLUMN content_revisions.field_path IS 'Array representing nested field path, e.g., ["content", "hero", "title"]';
COMMENT ON COLUMN content_revisions.diff_json IS 'Structured diff showing what changed in JSON format';

-- ============================================
-- 2. Create content_entities table
-- ============================================

CREATE TABLE IF NOT EXISTS content_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- 'site_section', 'room', 'product', 'blog_post', 'page'
    entity_id UUID NOT NULL,
    content_key VARCHAR(100) NOT NULL, -- 'title', 'description', 'content.body'
    content_value JSONB NOT NULL,
    content_schema JSONB, -- JSON Schema for validation
    current_revision_id UUID REFERENCES content_revisions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique content keys per entity
    UNIQUE(entity_type, entity_id, content_key)
);

-- Add indexes for content_entities
CREATE INDEX IF NOT EXISTS idx_content_entities_type ON content_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_content_entities_entity_id ON content_entities(entity_id);
CREATE INDEX IF NOT EXISTS idx_content_entities_revision ON content_entities(current_revision_id);

-- Add comment
COMMENT ON TABLE content_entities IS 'Tracks all content fields across different entity types for unified content management';

-- ============================================
-- 3. Create update_content_with_revision function
-- ============================================

CREATE OR REPLACE FUNCTION update_content_with_revision(
    p_entity_type VARCHAR(50),
    p_entity_id UUID,
    p_field_path TEXT[],
    p_new_value JSONB,
    p_reason TEXT DEFAULT 'Content update',
    p_change_category VARCHAR(50) DEFAULT 'content',
    p_execution_id UUID DEFAULT NULL,
    p_company_id UUID DEFAULT NULL,
    p_actor_user_id UUID DEFAULT NULL
) RETURNS TABLE (
    success BOOLEAN,
    revision_id UUID,
    message TEXT
) AS $$
DECLARE
    v_old_value JSONB;
    v_content_entity_id UUID;
    v_revision_id UUID;
BEGIN
    -- Get or create content entity
    SELECT id, content_value INTO v_content_entity_id, v_old_value
    FROM content_entities
    WHERE entity_type = p_entity_type 
      AND entity_id = p_entity_id 
      AND content_key = p_field_path[1];
    
    IF NOT FOUND THEN
        -- Create new content entity
        INSERT INTO content_entities (entity_type, entity_id, content_key, content_value)
        VALUES (p_entity_type, p_entity_id, p_field_path[1], '{}'::JSONB)
        RETURNING id INTO v_content_entity_id;
        v_old_value := '{}'::JSONB;
    END IF;
    
    -- Create revision record
    INSERT INTO content_revisions (
        execution_id,
        company_id,
        actor_user_id,
        table_name,
        record_id,
        field_name,
        field_path,
        old_value,
        new_value,
        change_reason,
        change_category,
        revision_status,
        content_type,
        content_id,
        applied_at,
        applied_by
    ) VALUES (
        p_execution_id,
        p_company_id,
        p_actor_user_id,
        CASE 
            WHEN p_entity_type = 'site_section' THEN 'site_sections'
            WHEN p_entity_type = 'room' THEN 'rooms'
            WHEN p_entity_type = 'product' THEN 'products'
            WHEN p_entity_type = 'blog_post' THEN 'blog_posts'
            ELSE p_entity_type || 's'
        END,
        p_entity_id,
        array_to_string(p_field_path, '.'),
        p_field_path,
        v_old_value,
        p_new_value,
        p_reason,
        p_change_category,
        'applied',
        p_entity_type,
        p_entity_id,
        NOW(),
        p_actor_user_id
    )
    RETURNING id INTO v_revision_id;
    
    -- Update content entity
    UPDATE content_entities
    SET 
        content_value = p_new_value,
        current_revision_id = v_revision_id,
        updated_at = NOW()
    WHERE id = v_content_entity_id;
    
    RETURN QUERY SELECT TRUE, v_revision_id, 'Content updated successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_content_with_revision IS 'Updates content with automatic revision tracking';

-- ============================================
-- 4. Create function to get content history
-- ============================================

CREATE OR REPLACE FUNCTION get_content_history(
    p_entity_type VARCHAR(50),
    p_entity_id UUID,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    revision_id UUID,
    changed_at TIMESTAMP WITH TIME ZONE,
    changed_by UUID,
    change_reason TEXT,
    old_value JSONB,
    new_value JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cr.id,
        cr.applied_at,
        cr.applied_by,
        cr.change_reason,
        cr.old_value,
        cr.new_value
    FROM content_revisions cr
    WHERE cr.content_type = p_entity_type
      AND cr.content_id = p_entity_id
    ORDER BY cr.applied_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_content_history IS 'Retrieves revision history for a content entity';

-- ============================================
-- 5. Add trigger to auto-update content_entities timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_content_entities_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_entities_timestamp ON content_entities;

CREATE TRIGGER content_entities_timestamp
    BEFORE UPDATE ON content_entities
    FOR EACH ROW
    EXECUTE FUNCTION update_content_entities_timestamp();

-- ============================================
-- 6. Enable RLS on content_entities
-- ============================================

ALTER TABLE content_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_entities_company_policy" ON content_entities
    FOR ALL
    USING (true)  -- Adjust based on your security requirements
    WITH CHECK (true);

-- ============================================
-- 7. Add view for content with latest revision
-- ============================================

CREATE OR REPLACE VIEW v_content_latest AS
SELECT 
    ce.id as content_entity_id,
    ce.entity_type,
    ce.entity_id,
    ce.content_key,
    ce.content_value,
    ce.content_schema,
    ce.created_at,
    ce.updated_at,
    cr.id as revision_id,
    cr.change_reason as last_change_reason,
    cr.applied_by as last_changed_by,
    cr.applied_at as last_changed_at
FROM content_entities ce
LEFT JOIN content_revisions cr ON ce.current_revision_id = cr.id;

COMMENT ON VIEW v_content_latest IS 'Shows all content entities with their latest revision info';
