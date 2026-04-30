-- 073_akashic_substrate.sql
-- The foundation for the Sovereign Intelligence distributed network and identity matrix.

-- 1. Sovereign Nodes: Distributed exit points (The Mesh)
CREATE TABLE IF NOT EXISTS sovereign_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_type TEXT NOT NULL, -- 'residential', 'datacenter', 'iot', 'shadow'
    provider TEXT,
    region TEXT,
    ip_address TEXT,
    latency_ms INTEGER,
    success_rate DECIMAL(5,2) DEFAULT 0,
    status TEXT DEFAULT 'active', -- 'active', 'flagged', 'burned'
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- 2. Identity Matrices: High-fidelity digital fingerprints (The Morph)
CREATE TABLE IF NOT EXISTS identity_matrices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE,
    user_agent TEXT NOT NULL,
    screen_resolution TEXT,
    canvas_fingerprint TEXT,
    webgl_vendor TEXT,
    webgl_renderer TEXT,
    plugins_hash TEXT,
    reputation_score INTEGER DEFAULT 100, -- 0 to 100
    behavior_profile JSONB DEFAULT '{}', -- Simulated mouse/keyboard patterns
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Evolution Logs: Recursive code mutation history (The ARK)
CREATE TABLE IF NOT EXISTS evolution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_component TEXT, -- 'proxy', 'orchestrator', 'architect'
    mutation_type TEXT, -- 'performance_optimization', 'security_bypass', 'logic_refactor'
    previous_state_hash TEXT,
    new_state_hash TEXT,
    diff_summary TEXT,
    telemetry_trigger_id UUID REFERENCES system_telemetry(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Dimensional Routing: Real-time path optimization
CREATE TABLE IF NOT EXISTS dimensional_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_domain TEXT NOT NULL,
    best_node_id UUID REFERENCES sovereign_nodes(id),
    best_identity_id UUID REFERENCES identity_matrices(id),
    bypass_strategy TEXT, -- 'neural_stealth', 'brute_force', 'morph_sync'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sovereign_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_matrices ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dimensional_routes ENABLE ROW LEVEL SECURITY;

-- Policies (Admin only for now)
CREATE POLICY "Admin full access nodes" ON sovereign_nodes FOR ALL USING (true);
CREATE POLICY "Admin full access identities" ON identity_matrices FOR ALL USING (true);
CREATE POLICY "Admin full access evolutions" ON evolution_logs FOR ALL USING (true);
CREATE POLICY "Admin full access routes" ON dimensional_routes FOR ALL USING (true);
