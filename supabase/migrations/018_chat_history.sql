-- Migration: Chat History for Mastermind AI
-- Description: Store conversation history for intelligent context-aware responses

-- ============================================
-- CHAT_HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    command_executed TEXT,
    command_result TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Index for fast retrieval by session
    CONSTRAINT chat_history_session_idx UNIQUE (id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_session_created ON chat_history(session_id, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own messages
CREATE POLICY chat_history_select_own
    ON chat_history
    FOR SELECT
    USING (
        user_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM master_admins WHERE email = auth.email()
        )
    );

-- Policy: Users can only insert their own messages
CREATE POLICY chat_history_insert_own
    ON chat_history
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM master_admins WHERE email = auth.email()
        )
    );

-- Policy: Users can only delete their own messages
CREATE POLICY chat_history_delete_own
    ON chat_history
    FOR DELETE
    USING (
        user_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM master_admins WHERE email = auth.email()
        )
    );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get chat history for a session
CREATE OR REPLACE FUNCTION get_chat_history(
    p_session_id TEXT,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    role TEXT,
    content TEXT,
    command_executed TEXT,
    command_result TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ch.id,
        ch.role,
        ch.content,
        ch.command_executed,
        ch.command_result,
        ch.created_at
    FROM chat_history ch
    WHERE ch.session_id = p_session_id
        AND (
            ch.user_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM master_admins WHERE email = auth.email()
            )
        )
    ORDER BY ch.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear chat history for a session
CREATE OR REPLACE FUNCTION clear_chat_history(
    p_session_id TEXT
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM chat_history
    WHERE session_id = p_session_id
        AND (
            user_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM master_admins WHERE email = auth.email()
            )
        );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CLEANUP FUNCTION (Optional: Auto-delete old messages)
-- ============================================

-- Function to delete messages older than X days
CREATE OR REPLACE FUNCTION cleanup_old_chat_history(
    p_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM chat_history
    WHERE created_at < NOW() - INTERVAL '1 day' * p_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE chat_history IS 'Stores conversation history for Mastermind AI chat interface';
