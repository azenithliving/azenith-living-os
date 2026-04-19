-- Create consultant_learnings table
CREATE TABLE IF NOT EXISTS public.consultant_learnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instruction TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create consultant_pending_questions table
CREATE TABLE IF NOT EXISTS public.consultant_pending_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, answered
    created_at TIMESTAMPTZ DEFAULT now()
);
