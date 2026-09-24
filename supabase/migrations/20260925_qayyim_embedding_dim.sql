-- P1 Grounding: qayyim_semantic_memory.embedding VECTOR(1536) -> VECTOR(768)
-- Why 768: SharedMemory now generates REAL Gemini gemini-embedding-001 embeddings
-- truncated to 768 dims (outputDimensionality) via the "google" key pool. The old
-- 1536-dim rows came from the fake hash-based era and are semantically worthless —
-- they also block the type change — so they are cleared before altering.
-- Idempotent: skips when already 768.

DO $$
DECLARE
  current_dims INTEGER;
BEGIN
  IF to_regclass('public.qayyim_semantic_memory') IS NULL THEN
    RAISE NOTICE 'qayyim_semantic_memory missing — nothing to do';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'qayyim_semantic_memory'
      AND column_name = 'embedding'
  ) THEN
    RAISE NOTICE 'embedding column missing — nothing to do';
    RETURN;
  END IF;

  SELECT vector_dims(embedding) INTO current_dims
  FROM public.qayyim_semantic_memory
  LIMIT 1;

  IF current_dims IS NOT NULL AND current_dims = 768 THEN
    RAISE NOTICE 'embedding already vector(768) — nothing to do';
    RETURN;
  END IF;

  -- Fake-era 1536-dim garbage: worthless AND blocking the type change.
  TRUNCATE TABLE public.qayyim_semantic_memory;

  -- The old HNSW index depends on the column type — drop before ALTER.
  DROP INDEX IF EXISTS public.idx_qayyim_semantic_memory_embedding;

  ALTER TABLE public.qayyim_semantic_memory
    ALTER COLUMN embedding TYPE vector(768);
END $$;

CREATE INDEX IF NOT EXISTS idx_qayyim_semantic_memory_embedding
  ON public.qayyim_semantic_memory
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ANALYZE public.qayyim_semantic_memory;
