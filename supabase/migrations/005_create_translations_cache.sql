-- Create translations_cache table for server-side AI translation storage
-- This vault minimizes AI costs by caching translations permanently

CREATE TABLE IF NOT EXISTS translations_cache (
  hash TEXT PRIMARY KEY,
  source_text TEXT NOT NULL,
  source_lang TEXT NOT NULL DEFAULT 'ar',
  en_text TEXT NOT NULL,
  context TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_translations_cache_hash ON translations_cache(hash);

-- Add RLS policies for secure access
ALTER TABLE translations_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for client-side cache retrieval)
CREATE POLICY "Allow public read access on translations_cache"
  ON translations_cache
  FOR SELECT
  TO PUBLIC
  USING (true);

-- Allow only service_role to insert/update (server-side only)
CREATE POLICY "Allow service role insert on translations_cache"
  ON translations_cache
  FOR INSERT
  TO SERVICE_ROLE
  WITH CHECK (true);

CREATE POLICY "Allow service role update on translations_cache"
  ON translations_cache
  FOR UPDATE
  TO SERVICE_ROLE
  USING (true);

-- Create function to compute hash (for consistency)
CREATE OR REPLACE FUNCTION compute_translation_hash(source_text TEXT, context TEXT DEFAULT NULL)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(source_text || COALESCE(context, ''), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comment for documentation
COMMENT ON TABLE translations_cache IS 'Server-side vault for AI translations to minimize costs and maximize speed';
