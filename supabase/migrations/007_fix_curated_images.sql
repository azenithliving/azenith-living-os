-- Migration 007: Fix curated_images table - Add missing columns

-- Add display_order column
ALTER TABLE public.curated_images 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add source column to track image origin
ALTER TABLE public.curated_images 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'pexels';

-- Add quality_score for AI filtering results
ALTER TABLE public.curated_images 
ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2) DEFAULT 0;

-- Add original_url column for CDN URLs
ALTER TABLE public.curated_images 
ADD COLUMN IF NOT EXISTS original_url TEXT;

-- Add thumbnail_url column
ALTER TABLE public.curated_images 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Create index for display_order
CREATE INDEX IF NOT EXISTS idx_curated_images_display_order 
    ON public.curated_images(display_order);

-- Verify columns added
SELECT 
    'Migration 007 Applied' as status,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'curated_images' 
     AND column_name IN ('display_order', 'source', 'quality_score')) as new_columns_added;
