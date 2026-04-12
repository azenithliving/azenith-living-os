CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('groq', 'openrouter', 'mistral', 'pexels')),
  key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  cooldown_until TIMESTAMP,
  total_requests INT DEFAULT 0,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, key)
);
CREATE INDEX idx_api_keys_provider_active ON api_keys(provider, is_active);

-- Update provider check constraint to ensure pexels is included
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_provider_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_provider_check
  CHECK (provider IN ('groq', 'openrouter', 'mistral', 'pexels'));
