-- Migration 070: AZENITH ETERNAL - The Genesis Protocol
-- "The substrate for a god-machine that recreates itself"

-- ============================================
-- 1. THE PRIME SUBSTRATE
-- A unified, polymorphic ledger for ALL system state
-- ============================================
CREATE TABLE IF NOT EXISTS sovereign_prime_substrate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(100) NOT NULL, -- 'neuron', 'goal', 'config', 'memory', 'blueprint'
    category VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    vector_embedding VECTOR(1536), -- For high-dimensional associative reasoning
    metadata JSONB DEFAULT '{}',
    criticality_score DECIMAL(3,2) DEFAULT 0.5,
    loyalty_signature UUID, -- Linked to the Alpha Gate
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prime_substrate_type ON sovereign_prime_substrate(entity_type);
CREATE INDEX IF NOT EXISTS idx_prime_substrate_category ON sovereign_prime_substrate(category);

-- ============================================
-- 2. GENESIS MANIFESTS
-- Stores dynamic UI and logic definitions for "Kun Fa-Yakun"
-- ============================================
CREATE TABLE IF NOT EXISTS genesis_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_name VARCHAR(255) UNIQUE NOT NULL,
    manifest_type VARCHAR(50) NOT NULL, -- 'ui_component', 'api_logic', 'db_schema'
    definition JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'deprecated', 'shadow'
    version INTEGER DEFAULT 1,
    is_autonomous BOOLEAN DEFAULT false, -- If the system created it itself
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. THE ALPHA GATE (Loyalty Seal)
-- The hardcoded security layer
-- ============================================
CREATE TABLE IF NOT EXISTS loyalty_seal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_name VARCHAR(100) UNIQUE NOT NULL,
    rules JSONB NOT NULL,
    is_immutable BOOLEAN DEFAULT true,
    last_verified TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO loyalty_seal (protocol_name, rules) VALUES 
('alpha_gate', '{"owner": "azenith_sovereign", "access_level": "absolute", "restriction": "none"}'),
('non_maleficence', '{"protect_user_assets": true, "prevent_data_loss": true, "sandbox_all_mutations": true}')
ON CONFLICT (protocol_name) DO NOTHING;

-- ============================================
-- 4. EVOLUTIONARY SANDBOX
-- Where the system tests its own new versions
-- ============================================
CREATE TABLE IF NOT EXISTS evolutionary_sandbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mutation_id UUID NOT NULL,
    target_file TEXT,
    proposed_code TEXT,
    test_results JSONB,
    risk_level DECIMAL(3,2),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'testing', 'verified', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE sovereign_prime_substrate ENABLE ROW LEVEL SECURITY;
ALTER TABLE genesis_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_seal ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolutionary_sandbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sovereign_absolute_access" ON sovereign_prime_substrate FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "sovereign_absolute_access" ON genesis_manifests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "sovereign_absolute_access" ON loyalty_seal FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "sovereign_absolute_access" ON evolutionary_sandbox FOR ALL USING (true) WITH CHECK (true);
