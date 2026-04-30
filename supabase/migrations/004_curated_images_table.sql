-- Migration 004: Curated Images Table for Azenith Infinite Pulse Protocol
-- Purpose: Store elite curated images with metadata for the gallery system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CURATED_IMAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.curated_images (
    id BIGINT PRIMARY KEY,
    url TEXT NOT NULL,
    room_type TEXT NOT NULL,
    style TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
-- Query by room type and style (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_curated_images_room_style 
    ON public.curated_images(room_type, style) 
    WHERE is_active = true;

-- Query for random sampling
CREATE INDEX IF NOT EXISTS idx_curated_images_active 
    ON public.curated_images(is_active, room_type, style);

-- Full-text search on metadata
CREATE INDEX IF NOT EXISTS idx_curated_images_metadata_gin 
    ON public.curated_images USING GIN (metadata);

-- Prevent duplicate URLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_curated_images_url 
    ON public.curated_images(url);

-- ============================================
-- TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS curated_images_set_updated_at ON public.curated_images;
CREATE TRIGGER curated_images_set_updated_at 
    BEFORE UPDATE ON public.curated_images 
    FOR EACH ROW 
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.curated_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS curated_images_read_access ON public.curated_images;
CREATE POLICY curated_images_read_access 
    ON public.curated_images 
    FOR SELECT 
    USING (is_active = true);

DROP POLICY IF EXISTS curated_images_admin_access ON public.curated_images;
CREATE POLICY curated_images_admin_access 
    ON public.curated_images 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get random images for a room
CREATE OR REPLACE FUNCTION public.get_random_curated_images(
    p_room_type TEXT,
    p_style TEXT,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id BIGINT,
    url TEXT,
    metadata JSONB
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT ci.id, ci.url, ci.metadata
    FROM public.curated_images ci
    WHERE ci.room_type = p_room_type
      AND ci.style = p_style
      AND ci.is_active = true
    ORDER BY RANDOM()
    LIMIT p_limit;
END;
$$;

-- Function to mark dead images
CREATE OR REPLACE FUNCTION public.mark_dead_image(p_image_id BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.curated_images
    SET is_active = false,
        metadata = metadata || '{"marked_dead_at": "' || NOW()::text || '"}'::jsonb
    WHERE id = p_image_id;
END;
$$;

-- Function to get image count per category
CREATE OR REPLACE FUNCTION public.get_curated_image_stats()
RETURNS TABLE (
    room_type TEXT,
    style TEXT,
    active_count BIGINT,
    total_count BIGINT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.room_type,
        ci.style,
        COUNT(*) FILTER (WHERE ci.is_active = true) as active_count,
        COUNT(*) as total_count
    FROM public.curated_images ci
    GROUP BY ci.room_type, ci.style
    ORDER BY ci.room_type, ci.style;
END;
$$;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 
    'Migration 004 Applied Successfully' as status,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name = 'curated_images') as tables_created;
