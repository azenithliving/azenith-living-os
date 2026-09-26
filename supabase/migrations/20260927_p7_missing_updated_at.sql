-- P7: two tables carry a BEFORE UPDATE trigger that writes NEW.updated_at while
-- the column does not exist, so every UPDATE on them threw 42703 — the swarm's
-- learning ledger could never reinforce or retire a lesson, and curated images
-- could never change status. Proven with a rolled-back UPDATE probe on each.
-- The trigger promises the column, so the column is what the tables were missing.

ALTER TABLE public.qayyim_swarm_learnings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.curated_images ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

NOTIFY pgrst, 'reload schema';
