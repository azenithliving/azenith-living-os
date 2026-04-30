-- Migration 061: Fix Agent Goals Table
-- Ensure priority column exists in agent_goals

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'agent_goals' 
        AND column_name = 'priority'
    ) THEN
        ALTER TABLE agent_goals ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'normal';
    END IF;
END $$;
