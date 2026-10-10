-- The watcher keeps a log: an alert has to outlive the request that found it.
--
-- Measured 2026-10-10: `lib/sentinel.ts` held its alerts in a Map declared next to the module code.
-- On this host every request is served by a function that starts empty, so the alert existed for the
-- microseconds between writing and answering and was gone for the next reader. The screen that asks
-- the door always heard «مفيش تنبيهات», and a permanent zero is not a clean bill of health — it is an
-- organ that forgets.
--
-- One row per open condition, and history that is never deleted: `dedupe_key` is the noun the
-- measurement is about («api:xai», «database:connection», «memory:heap»). While an alert is waiting
-- for a decision it holds that key alone, so a second reading of the same condition raises
-- `occurrences` and moves `last_seen_at` instead of adding a twin row. The key is released the moment
-- an operator resolves or dismisses the alert, so the same condition coming back next week becomes a
-- new row with its own first sighting — and the old row stays exactly where it was decided.
--
-- The sentences are stored already written in the owner's Arabic, because the fix for an alert that
-- spoke English was at the source, not at the render. `error_log` keeps the exception text for an
-- operator, where it does not reach his screen.
--
-- Row level security is on with one policy for the store's own service client: nothing public reads
-- this table, and nothing public writes it. Nothing here deletes or changes any existing row.
--SPLIT--
create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrences integer not null default 1,
  severity text not null check (severity in ('info','warning','critical')),
  category text not null check (category in ('api','database','cache','memory','external')),
  problem text not null,
  root_cause text not null,
  proposed_fix text not null,
  auto_fixable boolean not null default false,
  status text not null default 'pending' check (status in ('pending','applying','resolved','dismissed')),
  applied_at timestamptz,
  resolved_at timestamptz,
  error_log text,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
--SPLIT--
alter table public.system_alerts enable row level security;
--SPLIT--
create policy "service_role_system_alerts" on public.system_alerts
  for all to service_role using (true) with check (true);
--SPLIT--
-- The screen reads the newest sightings first.
create index if not exists system_alerts_last_seen_idx on public.system_alerts (last_seen_at desc);
--SPLIT--
-- The watcher asks for whatever still waits for a decision.
create index if not exists system_alerts_open_idx on public.system_alerts (status, last_seen_at desc);
--SPLIT--
create trigger update_system_alerts_updated_at
  before update on public.system_alerts
  for each row execute function public.set_updated_at();
