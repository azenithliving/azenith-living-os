-- ============================================================================
-- MIGRATION 005: Room Sections Table - Complete Setup
-- Run this in Supabase SQL Editor: 
-- https://supabase.com/dashboard/project/dmavypdmtbxzwrexqesu/sql-editor
-- ============================================================================

-- Step 1: Add all required columns to room_sections table (if table exists)
-- or create the table with all columns

-- First, let's ensure the table exists with proper structure
DROP TABLE IF EXISTS public.room_sections CASCADE;

CREATE TABLE public.room_sections (
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

-- Step 2: Create indexes for performance
CREATE INDEX idx_room_sections_company_active 
    ON public.room_sections(company_id, is_active, display_order);

CREATE INDEX idx_room_sections_slug 
    ON public.room_sections(slug);

-- Step 3: Enable Row Level Security
ALTER TABLE public.room_sections ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policy for tenant isolation
DROP POLICY IF EXISTS room_sections_isolation ON public.room_sections;

CREATE POLICY room_sections_isolation ON public.room_sections
FOR ALL
USING (company_id = public.current_company_id())
WITH CHECK (company_id = public.current_company_id());

-- Step 5: Insert 15 Interior Sections for Azenith Living
-- Get the company ID first (using the default company)
DO $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Get the first company (or create default if none exists)
    SELECT id INTO v_company_id FROM public.companies ORDER BY created_at LIMIT 1;
    
    IF v_company_id IS NULL THEN
        -- Insert default company
        INSERT INTO public.companies (name, domain, primary_color, whatsapp)
        VALUES ('Azenith Living', 'azenithliving.vercel.app', '#C5A059', '201090819584')
        RETURNING id INTO v_company_id;
    END IF;

    -- Insert the 15 interior sections
    INSERT INTO public.room_sections (company_id, slug, name, name_ar, description, icon, display_order, is_active, metadata)
    VALUES
        (v_company_id, 'living-room', 'Living Room', 'غرفة المعيشة', 'Luxury living room furniture and interior design', 'sofa', 1, true, '{"category": "interior", "priority": "high"}'),
        (v_company_id, 'dining-room', 'Dining Room', 'غرفة الطعام', 'Elegant dining room furniture and setups', 'utensils', 2, true, '{"category": "interior", "priority": "high"}'),
        (v_company_id, 'kitchen', 'Kitchen', 'المطبخ', 'Modern kitchen designs and cabinetry', 'chef-hat', 3, true, '{"category": "interior", "priority": "high"}'),
        (v_company_id, 'master-bedroom', 'Master Bedroom', 'غرفة النوم الرئيسية', 'Premium master bedroom furniture and design', 'bed', 4, true, '{"category": "interior", "priority": "high"}'),
        (v_company_id, 'guest-bedroom', 'Guest Bedroom', 'غرفة نوم الضيوف', 'Comfortable guest bedroom solutions', 'bed-single', 5, true, '{"category": "interior", "priority": "medium"}'),
        (v_company_id, 'kids-bedroom', 'Kids Bedroom', 'غرفة الأطفال', 'Playful and functional kids bedroom furniture', 'toy', 6, true, '{"category": "interior", "priority": "medium"}'),
        (v_company_id, 'teen-room', 'Teen Room', 'غرفة المراهقين', 'Modern teenager bedroom with study area', 'user', 7, true, '{"category": "interior", "priority": "medium"}'),
        (v_company_id, 'dressing-room', 'Dressing Room', 'غرفة الملابس', 'Walk-in closets and dressing room solutions', 'shirt', 8, true, '{"category": "interior", "priority": "medium"}'),
        (v_company_id, 'home-office', 'Home Office', 'مكتب المنزل', 'Executive home office and study room furniture', 'briefcase', 9, true, '{"category": "interior", "priority": "high"}'),
        (v_company_id, 'study-room', 'Study Room', 'غرفة الدراسة', 'Dedicated study and reading room design', 'book-open', 10, true, '{"category": "interior", "priority": "medium"}'),
        (v_company_id, 'bathroom', 'Bathroom', 'الحمام', 'Luxury bathroom fixtures and design', 'bath', 11, true, '{"category": "interior", "priority": "medium"}'),
        (v_company_id, 'guest-bathroom', 'Guest Bathroom', 'حمام الضيوف', 'Elegant guest bathroom solutions', 'bath', 12, true, '{"category": "interior", "priority": "low"}'),
        (v_company_id, 'entrance-lobby', 'Entrance/Lobby', 'المدخل', 'Grand entrance and lobby furniture', 'door-open', 13, true, '{"category": "interior", "priority": "medium"}'),
        (v_company_id, 'corner-sofa', 'Corner Sofa', 'كنب الزاوية', 'Luxury sectional and corner sofa options', 'lamp', 14, true, '{"category": "interior", "priority": "low"}'),
        (v_company_id, 'lounge', 'Lounge', 'الاستراحة', 'Premium lounge seating and relaxation areas', 'couch', 15, true, '{"category": "interior", "priority": "medium"}');

    RAISE NOTICE 'Inserted 15 interior sections for company: %', v_company_id;
END $$;

-- Step 6: Verify the results
SELECT 
    'Migration 005 Complete' as status,
    (SELECT COUNT(*) FROM public.room_sections WHERE is_active = true) as active_sections_count,
    (SELECT COUNT(DISTINCT company_id) FROM public.room_sections) as companies_with_sections;

-- Show the inserted sections
SELECT 
    display_order,
    slug,
    name,
    name_ar,
    is_active,
    company_id
FROM public.room_sections 
ORDER BY display_order;
