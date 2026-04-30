-- Migration: Add is_active column to curated_images table
-- Run this in Supabase SQL Editor if you want image-level activation control

ALTER TABLE curated_images 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add index for performance (optional)
CREATE INDEX IF NOT EXISTS idx_curated_images_is_active 
ON curated_images(is_active) 
WHERE is_active = true;

-- Backfill existing rows to be active
UPDATE curated_images 
SET is_active = true 
WHERE is_active IS NULL;

COMMENT ON COLUMN curated_images.is_active IS 'Soft delete flag - false hides image from gallery';
