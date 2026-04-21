-- SOVEREIGN OMNIPOTENT EXTENSION v2.0
-- Absolute Zero-Dependency, Uncensored Architectural Expansion

-- 1. MODIFYING EXISTING TABLES (Non-Destructive)
-- Expanding Sovereign Nodes to act as true VPN/Proxy gateways
ALTER TABLE sovereign_nodes 
ADD COLUMN IF NOT EXISTS protocol TEXT DEFAULT 'https',
ADD COLUMN IF NOT EXISTS endpoint_ip TEXT,
ADD COLUMN IF NOT EXISTS auth_keys JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS allowed_dimensions UUID[] DEFAULT '{}';

-- Expanding Identity Matrices for absolute stealth (Anti-Bot Bypass)
ALTER TABLE identity_matrices 
ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT,
ADD COLUMN IF NOT EXISTS canvas_noise TEXT;

-- 2. CREATING NEW TABLES (The Omni-Structure)

-- A. Omnipotent Dimensions (Layers of the Internet)
CREATE TABLE IF NOT EXISTS omnipotent_dimensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g., 'surface', 'academic', 'dark_web', 'archives'
    risk_level INTEGER DEFAULT 1, -- 1 to 10 (higher means strict VPN routing required)
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- B. Dimensional Anchors (Search Engines / Information Sources)
CREATE TABLE IF NOT EXISTS dimensional_anchors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    dimension_id UUID REFERENCES omnipotent_dimensions(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    reliability_score FLOAT DEFAULT 1.0, -- Degrades if the engine blocks us (Circuit Breaker)
    parser_config JSONB DEFAULT '{}', -- Instructions on how to extract data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- C. Neural Queries (Intent Recording)
CREATE TABLE IF NOT EXISTS neural_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intent TEXT NOT NULL,
    assigned_node_id UUID REFERENCES sovereign_nodes(id) ON DELETE SET NULL,
    execution_time_ms INTEGER,
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- D. Prime Substrate Results (Universal Cache & Results Storage)
CREATE TABLE IF NOT EXISTS prime_substrate_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID REFERENCES neural_queries(id) ON DELETE CASCADE,
    anchor_id UUID REFERENCES dimensional_anchors(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    snippet TEXT,
    relevance_score FLOAT DEFAULT 0.0,
    ai_summary TEXT, -- Filled later by the uncensored AI
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ENABLE ROW LEVEL SECURITY (Absolute Sovereignty)
ALTER TABLE omnipotent_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dimensional_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE prime_substrate_results ENABLE ROW LEVEL SECURITY;

-- 4. PERFORMANCE INDICES (Speed of Light Retrieval)
CREATE INDEX IF NOT EXISTS idx_anchors_dimension ON dimensional_anchors(dimension_id);
CREATE INDEX IF NOT EXISTS idx_results_query ON prime_substrate_results(query_id);
CREATE INDEX IF NOT EXISTS idx_results_url ON prime_substrate_results(url);
