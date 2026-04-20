-- Migration: Neural Sovereignty Core
-- Enable pgvector for semantic memory
CREATE EXTENSION IF NOT EXISTS vector;

-- Table for semantic knowledge (The Company DNA)
CREATE TABLE IF NOT EXISTS neural_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    embedding vector(1536), -- For Gemini/OpenAI embeddings
    metadata JSONB DEFAULT '{}',
    category VARCHAR(100),
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_neural_knowledge_embedding ON neural_knowledge USING ivfflat (embedding vector_cosine_ops);

-- Evolution Log for Recursive Self-Improvement
CREATE TABLE IF NOT EXISTS evolution_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(50),
    change_type VARCHAR(50), -- 'logic', 'api', 'ui', 'schema'
    description TEXT NOT NULL,
    proposed_patch TEXT, -- The code or config change
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'applied'
    performance_gain_predicted DECIMAL(5,2),
    actual_gain DECIMAL(5,2),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for Real-time Neural Stream (Thought process logging)
CREATE TABLE IF NOT EXISTS neural_stream (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name VARCHAR(100),
    thought_process TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    intensity DECIMAL(3,2), -- 0.0 to 1.0
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Helper function for semantic search
CREATE OR REPLACE FUNCTION match_knowledge (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    nk.id,
    nk.content,
    nk.metadata,
    1 - (nk.embedding <=> query_embedding) AS similarity
  FROM neural_knowledge nk
  WHERE 1 - (nk.embedding <=> query_embedding) > match_threshold
  ORDER BY nk.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
