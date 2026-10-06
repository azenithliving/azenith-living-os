-- The golden moment needs one memory: has the owner been woken for this sheet already?
-- Additive only — no table, no row, no old column is touched.
alter table if exists public.room_sketches add column if not exists pulse_sent_at timestamptz;
