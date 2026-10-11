-- The owner's word on the dismiss button: a reviewed alert keeps quiet for a day.
--
-- Measured 2026-10-11: closing an alert released its condition key, so the very next reading of the
-- same fault wrote a fresh row and the button looked dead — «مراجعة وإخفاء» hid the line for one
-- refresh. The owner was asked which he wanted and answered «موافق» to a named window: one day.
--
-- So the decision is stored where the decision is made, beside the row it was made about, instead of
-- mutating history: one row per condition, holding the moment it stops being muted. While the window
-- is open the watcher skips writing; when it closes and the fault is still real, it is recorded again
-- as a new sighting. Resolved alerts are never muted — a fix that ran and then failed again is news.
--
-- Nothing here deletes or changes any existing row.
--SPLIT--
create table if not exists public.system_alert_mutes (
  dedupe_key text primary key,
  alert_id uuid references public.system_alerts (id) on delete set null,
  muted_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
--SPLIT--
alter table public.system_alert_mutes enable row level security;
--SPLIT--
create policy "service_role_system_alert_mutes" on public.system_alert_mutes
  for all to service_role using (true) with check (true);
--SPLIT--
-- The watcher asks one question of this ledger on every write: is this condition still muted?
create index if not exists system_alert_mutes_until_idx on public.system_alert_mutes (muted_until);
--SPLIT--
create trigger update_system_alert_mutes_updated_at
  before update on public.system_alert_mutes
  for each row execute function public.set_updated_at();
