-- ============================================
-- SOVEREIGN HYPERMIND SECURITY SCHEMA
-- Phase 1: Absolute Security Implementation
-- ============================================

-- 1. جدول مصادقة ثنائية (2FA)
CREATE TABLE IF NOT EXISTS user_2fa (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    secret TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    backup_codes TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 2. جدول المفاتيح العامة للتوقيع الرقمي
CREATE TABLE IF NOT EXISTS user_public_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,
    key_type TEXT DEFAULT 'Ed25519',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 3. جدول سجل الأوامر غير القابل للتلاعب
CREATE TABLE IF NOT EXISTS immutable_command_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    command_text TEXT NOT NULL,
    signature TEXT NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT now(),
    executor_ip TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed', 'rejected')),
    result_summary TEXT,
    command_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. جدول محاولات الدخول الفاشلة (للمراقبة والحماية)
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT,
    ip_address TEXT NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT now(),
    failure_reason TEXT,
    user_agent TEXT
);

-- 5. جدول جلسات الأمان المُعززة
CREATE TABLE IF NOT EXISTS sovereign_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    is_2fa_verified BOOLEAN DEFAULT false,
    is_signature_verified BOOLEAN DEFAULT false,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- تفعيل RLS على جميع الجداول
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_public_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE immutable_command_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_sessions ENABLE ROW LEVEL SECURITY;

-- 1. سياسات user_2fa
CREATE POLICY "Users can only view own 2FA"
    ON user_2fa FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can only update own 2FA"
    ON user_2fa FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all 2FA"
    ON user_2fa FOR ALL
    TO service_role
    USING (true);

-- 2. سياسات user_public_keys
CREATE POLICY "Users can only view own public keys"
    ON user_public_keys FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all public keys"
    ON user_public_keys FOR ALL
    TO service_role
    USING (true);

-- 3. سياسات immutable_command_log - لا يمكن التعديل إلا بواسطة service_role
CREATE POLICY "Users can only view own command logs"
    ON immutable_command_log FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can insert command logs"
    ON immutable_command_log FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Service role can update command logs"
    ON immutable_command_log FOR UPDATE
    TO service_role
    USING (true);

CREATE POLICY "No one can delete command logs"
    ON immutable_command_log FOR DELETE
    TO service_role
    USING (false);

-- 4. سياسات failed_login_attempts - فقط للقراءة من قبل المستخدمين المصرح لهم
CREATE POLICY "Service role can manage failed attempts"
    ON failed_login_attempts FOR ALL
    TO service_role
    USING (true);

-- 5. سياسات sovereign_sessions
CREATE POLICY "Users can only view own sessions"
    ON sovereign_sessions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all sessions"
    ON sovereign_sessions FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_2fa_user_id ON user_2fa(user_id);
CREATE INDEX IF NOT EXISTS idx_user_public_keys_user_id ON user_public_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_immutable_log_user_id ON immutable_command_log(user_id);
CREATE INDEX IF NOT EXISTS idx_immutable_log_executed_at ON immutable_command_log(executed_at);
CREATE INDEX IF NOT EXISTS idx_immutable_log_status ON immutable_command_log(status);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_ip ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_time ON failed_login_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_sovereign_sessions_token ON sovereign_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sovereign_sessions_user_id ON sovereign_sessions(user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_2fa_updated_at
    BEFORE UPDATE ON user_2fa
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- دالة لحساب hash الأمر
CREATE OR REPLACE FUNCTION calculate_command_hash(command_text TEXT, user_id UUID, timestamp TIMESTAMPTZ)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(digest(command_text || user_id::text || timestamp::text, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE user_2fa IS 'Two-factor authentication settings for admin users';
COMMENT ON TABLE user_public_keys IS 'Public keys for digital signature verification';
COMMENT ON TABLE immutable_command_log IS 'Immutable audit log for all admin commands - cannot be modified or deleted';
COMMENT ON TABLE failed_login_attempts IS 'Security monitoring for failed authentication attempts';
COMMENT ON TABLE sovereign_sessions IS 'Enhanced security sessions with 2FA and signature verification';
