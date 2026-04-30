-- ==========================================
-- AZENITH SUPREME - Database Schema
-- Tables for all Supreme Sovereign engines
-- ==========================================

-- Swarm Nodes Table
CREATE TABLE IF NOT EXISTS swarm_nodes (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    model TEXT NOT NULL,
    specialty TEXT NOT NULL,
    intelligence INTEGER DEFAULT 85,
    status TEXT DEFAULT 'active',
    region TEXT DEFAULT 'us-east',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market Scenarios Table
CREATE TABLE IF NOT EXISTS market_scenarios (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    target_audience TEXT[],
    market_size INTEGER DEFAULT 0,
    estimated_conversion DECIMAL(5,2) DEFAULT 0,
    revenue_monthly INTEGER DEFAULT 0,
    revenue_yearly INTEGER DEFAULT 0,
    confidence INTEGER DEFAULT 70,
    competitive_advantage INTEGER DEFAULT 50,
    status TEXT DEFAULT 'simulated',
    deployed_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Snapshots Table (Atomic State)
CREATE TABLE IF NOT EXISTS system_snapshots (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    git_commit TEXT,
    file_state JSONB DEFAULT '{}',
    database_state JSONB DEFAULT '{}',
    runtime_state JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    rollback_available BOOLEAN DEFAULT true,
    emotional_context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Bottlenecks Table
CREATE TABLE IF NOT EXISTS performance_bottlenecks (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    file TEXT NOT NULL,
    function TEXT NOT NULL,
    severity TEXT NOT NULL,
    type TEXT NOT NULL,
    current_time_ms DECIMAL(10,2),
    target_time_ms DECIMAL(10,2),
    suggested_optimization JSONB DEFAULT '{}',
    status TEXT DEFAULT 'detected',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimization History Table
CREATE TABLE IF NOT EXISTS optimization_history (
    id SERIAL PRIMARY KEY,
    bottleneck_id TEXT,
    success BOOLEAN DEFAULT false,
    performance_gain DECIMAL(5,2) DEFAULT 0,
    time_saved_us BIGINT DEFAULT 0,
    snapshot_id TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security Threats Table
CREATE TABLE IF NOT EXISTS security_threats (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    source_ip TEXT,
    source_country TEXT,
    request_path TEXT,
    metrics JSONB DEFAULT '{}',
    status TEXT DEFAULT 'detected',
    auto_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blocked IPs Table
CREATE TABLE IF NOT EXISTS blocked_ips (
    ip TEXT PRIMARY KEY,
    reason TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unblocked_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT true
);

-- Defense Alerts Table
CREATE TABLE IF NOT EXISTS defense_alerts (
    id SERIAL PRIMARY KEY,
    threat_id TEXT,
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Semantic Cache Table (Layer 3)
CREATE TABLE IF NOT EXISTS semantic_cache (
    id SERIAL PRIMARY KEY,
    semantic_hash TEXT UNIQUE NOT NULL,
    exact_match TEXT NOT NULL,
    near_matches TEXT[],
    response TEXT NOT NULL,
    context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 1,
    emotional_weight DECIMAL(3,2) DEFAULT 0.5,
    source TEXT DEFAULT 'ai_generation',
    confidence DECIMAL(3,2) DEFAULT 0.9
);

-- Code Patterns Table
CREATE TABLE IF NOT EXISTS code_patterns (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    pattern TEXT NOT NULL,
    frequency INTEGER DEFAULT 1,
    examples TEXT[],
    confidence INTEGER DEFAULT 70,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Predicted Modules Table
CREATE TABLE IF NOT EXISTS predicted_modules (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT,
    predicted_file_path TEXT NOT NULL,
    code TEXT,
    confidence INTEGER DEFAULT 70,
    dependencies TEXT[],
    status TEXT DEFAULT 'predicted',
    triggered_by TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sovereign Reports Table
CREATE TABLE IF NOT EXISTS sovereign_reports (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stability INTEGER DEFAULT 100,
    threat_level TEXT DEFAULT 'none',
    summary TEXT,
    opportunities_count INTEGER DEFAULT 0,
    revenue_potential BIGINT DEFAULT 0,
    optimizations_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated Pages Table
CREATE TABLE IF NOT EXISTS generated_pages (
    id SERIAL PRIMARY KEY,
    path TEXT NOT NULL,
    code TEXT NOT NULL,
    scenario_id TEXT,
    deployed BOOLEAN DEFAULT false,
    deployed_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_swarm_nodes_status ON swarm_nodes(status);
CREATE INDEX IF NOT EXISTS idx_market_scenarios_status ON market_scenarios(status);
CREATE INDEX IF NOT EXISTS idx_system_snapshots_type ON system_snapshots(type);
CREATE INDEX IF NOT EXISTS idx_system_snapshots_timestamp ON system_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_threats_timestamp ON security_threats(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_hash ON semantic_cache(semantic_hash);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_access ON semantic_cache(access_count DESC);
CREATE INDEX IF NOT EXISTS idx_sovereign_reports_session ON sovereign_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_sovereign_reports_timestamp ON sovereign_reports(timestamp DESC);

-- Helper function for incrementing cache usage
CREATE OR REPLACE FUNCTION increment_neural_cache_usage(p_semantic_hash TEXT)
RETURNS void AS $$
BEGIN
    UPDATE semantic_cache
    SET access_count = access_count + 1,
        last_accessed = NOW()
    WHERE semantic_hash = p_semantic_hash;
END;
$$ LANGUAGE plpgsql;
