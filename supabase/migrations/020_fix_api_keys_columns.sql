-- Fix api_keys table: Add missing columns for add_key functionality
-- Date: 2026-04-13

-- Add is_backup column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'api_keys' AND column_name = 'is_backup'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN is_backup BOOLEAN DEFAULT false;
        COMMENT ON COLUMN api_keys.is_backup IS 'Whether this key is a backup key (inactive by default)';
    END IF;
END $$;

-- Add updated_at column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'api_keys' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
        COMMENT ON COLUMN api_keys.updated_at IS 'Last update timestamp for the key';
    END IF;
END $$;

-- Verify total_requests column exists (should already exist from 20260412_add_api_keys.sql)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'api_keys' AND column_name = 'total_requests'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN total_requests INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create updated_at trigger if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_api_keys_updated_at'
    ) THEN
        CREATE TRIGGER update_api_keys_updated_at
            BEFORE UPDATE ON api_keys
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Verify the table structure
COMMENT ON TABLE api_keys IS 'API keys storage with usage tracking and backup support';

-- Output current columns for verification
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;
