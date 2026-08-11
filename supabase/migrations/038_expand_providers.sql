-- ================================================================
-- Migration 038: Expand API Keys System to Support 16 Providers
-- ================================================================
-- Purpose: Expand provider support to 16 AI services with backup 
--          keys system, notes field, and comprehensive indexing
-- Date: 2026-08-10
-- ================================================================

-- Step 1: Add new columns for enhanced key management
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS is_backup BOOLEAN DEFAULT false;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS error_count INT DEFAULT 0;

-- Step 2: Expand provider constraint to support all 16 providers
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_provider_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_provider_check
  CHECK (provider IN (
    'groq',
    'openrouter',
    'mistral',
    'pexels',
    'cerebras',
    'sambanova',
    'together',
    'cohere',
    'deepseek',
    'openai',
    'google',
    'anthropic',
    'xai',
    'aimlapi',
    'cloudflare',
    'huggingface'
  ));

-- Step 3: Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_api_keys_backup ON api_keys(provider, is_backup) WHERE is_backup = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_cooldown ON api_keys(provider, cooldown_until) WHERE cooldown_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_active_provider ON api_keys(is_active, provider);

-- Step 4: Add comment for documentation
COMMENT ON TABLE api_keys IS 'Stores API keys for 16 AI providers with rotation, cooldown, and backup support';
COMMENT ON COLUMN api_keys.is_backup IS 'Backup keys auto-activate at 90% daily quota';
COMMENT ON COLUMN api_keys.notes IS 'Admin notes for key identification and management';
COMMENT ON COLUMN api_keys.last_error IS 'Last error message from API (401, 403, etc)';
COMMENT ON COLUMN api_keys.error_count IS 'Number of consecutive errors (3+ = dead key)';
