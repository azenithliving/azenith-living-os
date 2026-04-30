-- Create table for storing 2FA secrets
CREATE TABLE IF NOT EXISTS user_2fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  secret TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert admin user 2FA record (will be updated when 2FA is first enabled)
INSERT INTO user_2fa (email, secret, is_enabled)
VALUES ('azenithliving@gmail.com', '', false)
ON CONFLICT (email) DO NOTHING;
