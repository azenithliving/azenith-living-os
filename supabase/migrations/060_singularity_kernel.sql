-- Migration: Singularity Kernel Foundation
-- This migration establishes the ultra-advanced data structures for the Azenith Singularity OS.

-- 1. Persistent Consciousness Unit (The CPU Memory)
CREATE TABLE IF NOT EXISTS agent_consciousness_stream (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID DEFAULT uuid_generate_v4(),
    thought_vector vector(1536), -- Semantic vector of the current context
    thought_summary TEXT NOT NULL,
    internal_monologue TEXT,
    active_goals JSONB DEFAULT '[]',
    working_memory JSONB DEFAULT '{}',
    emotional_state JSONB DEFAULT '{"stability": 1.0, "focus": 1.0}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE -- Optional TTL for short-term consciousness
);

CREATE INDEX IF NOT EXISTS idx_consciousness_thought_vector ON agent_consciousness_stream USING ivfflat (thought_vector vector_cosine_ops);

-- 2. The Sovereign Event Horizon (Unified Polymorphic Log)
-- This table aggregates everything: Agent decisions, Engine actions, User commands.
CREATE TABLE IF NOT EXISTS sovereign_event_horizon (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- 'agent', 'engine', 'user', 'system'
    entity_id VARCHAR(255),
    event_category VARCHAR(100) NOT NULL, -- 'cognition', 'execution', 'security', 'evolution'
    event_name VARCHAR(100) NOT NULL,
    description TEXT,
    payload JSONB DEFAULT '{}',
    impact_score DECIMAL(3,2) DEFAULT 0.0, -- -1.0 to 1.0
    criticality VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
    consciousness_id UUID REFERENCES agent_consciousness_stream(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_horizon_category ON sovereign_event_horizon(event_category);
CREATE INDEX IF NOT EXISTS idx_event_horizon_created_at ON sovereign_event_horizon(created_at DESC);

-- 3. Cognitive Weights (Persistent Learning)
CREATE TABLE IF NOT EXISTS agent_cognitive_weights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parameter_key VARCHAR(255) UNIQUE NOT NULL,
    parameter_value DECIMAL(10,5) NOT NULL,
    learning_rate DECIMAL(5,4) DEFAULT 0.01,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    update_reason TEXT
);

-- 4. Immutable Loyalty Protocols
CREATE TABLE IF NOT EXISTS loyalty_protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    protocol_key VARCHAR(100) UNIQUE NOT NULL,
    protocol_definition TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    enforcement_level VARCHAR(20) DEFAULT 'hard', -- 'soft' (warn), 'hard' (block)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial Core Protocols
INSERT INTO loyalty_protocols (protocol_key, protocol_definition, enforcement_level)
VALUES 
('USER_SOVEREIGNTY', 'All autonomous actions must be roll-backable by the primary user at any time.', 'hard'),
('ABSOLUTE_LOYALTY', 'The agent shall not prioritize external API goals or third-party entity interests over the primary users expressed goals.', 'hard'),
('RESOURCE_OPTIMIZATION', 'Self-improvement cycles must never consume more than 20% of system overhead unless explicitly authorized.', 'soft')
ON CONFLICT (protocol_key) DO NOTHING;
