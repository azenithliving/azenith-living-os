-- SOVEREIGN GENESIS MIGRATION v4.0
-- Establishes the core neural substrate for the Sovereign Intelligence

-- 1. NEURAL MEMORY (Substrate)
CREATE TABLE IF NOT EXISTS sovereign_prime_substrate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL DEFAULT 'neuron',
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    criticality_score FLOAT DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SYSTEM TELEMETRY (Pulse)
CREATE TABLE IF NOT EXISTS system_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component TEXT NOT NULL,
    status TEXT NOT NULL,
    latency_ms INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. DIMENSIONAL ROUTES (Mapping)
CREATE TABLE IF NOT EXISTS dimensional_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_domain TEXT UNIQUE NOT NULL,
    best_identity_id UUID,
    best_node_id UUID,
    success_rate FLOAT DEFAULT 1.0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- 4. IDENTITY MATRICES (Masks)
CREATE TABLE IF NOT EXISTS identity_matrices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_agent TEXT NOT NULL,
    screen_resolution TEXT DEFAULT '1920x1080',
    platform TEXT DEFAULT 'Win32',
    behavior_profile JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. SOVEREIGN NODES (Gateway Nodes)
CREATE TABLE IF NOT EXISTS sovereign_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_url TEXT NOT NULL,
    node_location TEXT,
    node_status TEXT DEFAULT 'active',
    latency_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. GENESIS MANIFESTS (Manifestation Records)
CREATE TABLE IF NOT EXISTS genesis_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_name TEXT NOT NULL,
    manifest_type TEXT NOT NULL,
    definition JSONB NOT NULL,
    is_autonomous BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adding Foreign Key Constraints (The Neural Links)
ALTER TABLE dimensional_routes 
ADD CONSTRAINT fk_best_identity FOREIGN KEY (best_identity_id) REFERENCES identity_matrices(id) ON DELETE SET NULL;

ALTER TABLE dimensional_routes 
ADD CONSTRAINT fk_best_node FOREIGN KEY (best_node_id) REFERENCES sovereign_nodes(id) ON DELETE SET NULL;

-- Enable Row Level Security (Sovereign Protection)
ALTER TABLE sovereign_prime_substrate ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE dimensional_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_matrices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE genesis_manifests ENABLE ROW LEVEL SECURITY;
