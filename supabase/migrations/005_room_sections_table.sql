-- Migration 005: Room Sections Table for Interior Categories
-- Purpose: Store 15 interior design sections with active status and tenant linking

-- ============================================
-- ROOM_SECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.room_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    name_ar TEXT,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    icon TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(company_id, slug)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_room_sections_company_active 
    ON public.room_sections(company_id, is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_room_sections_slug 
    ON public.room_sections(slug);

-- ============================================
-- TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS room_sections_set_updated_at ON public.room_sections;
CREATE TRIGGER room_sections_set_updated_at 
    BEFORE UPDATE ON public.room_sections 
    FOR EACH ROW 
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.room_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_sections_isolation ON public.room_sections;
CREATE POLICY room_sections_isolation ON public.room_sections
FOR ALL
USING (company_id = public.current_company_id())
WITH CHECK (company_id = public.current_company_id());

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 
    'Migration 005 Applied Successfully' as status,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name = 'room_sections') as tables_created;
