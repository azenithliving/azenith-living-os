-- Fix api_keys table - Add missing columns
-- Run this in Supabase SQL Editor

-- 1. Add is_backup column
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS is_backup BOOLEAN DEFAULT false;

-- 2. Add updated_at column  
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Verify total_requests exists (should already exist)
-- If missing, uncomment next line:
-- ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS total_requests INTEGER DEFAULT 0;

-- 4. Create trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Verify columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;
