ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tier text;
