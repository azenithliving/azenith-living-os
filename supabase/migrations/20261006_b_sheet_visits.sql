-- The third heat proof needs a memory: how many times did this customer come back to his pictures?
--
-- The architecture raises a customer to «ساخن جداً» on three signals — he raised his paper, he
-- handed the link to a second person, or he returned to the pictures more than three times. The
-- first two are counted; the third had no rows anywhere, so the votes desk passed a literal zero
-- and a browser-only lead could burn for a week with the owner asleep.
--
-- One row per (sheet, device): the count of separate visits and the last time that device was
-- seen. The window between one visit and the next is applied inside the write itself, because two
-- phones on one family's link opening the sheet in the same second must still count one visit, and
-- a page that reloads after every colour tap is not a customer coming back.
--
-- The device label is a private string the phone generates for itself and keeps in its own storage.
-- It says nothing about who — only that the same pair of eyes returned. Row level security stays on
-- with no policy: this table is only ever reached by the store's own code with the service client.
--SPLIT--
create table if not exists public.sheet_visits (
  sketch_id integer not null references public.room_sketches (id) on delete cascade,
  device_key text not null,
  visit_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (sketch_id, device_key)
);
--SPLIT--
alter table public.sheet_visits enable row level security;
--SPLIT--
-- The owner's desk reads a sheet's returns beside its votes.
create index if not exists sheet_visits_sketch_idx on public.sheet_visits (sketch_id);
--SPLIT--
create or replace function public.register_sheet_visit(p_sketch integer, p_device text, p_gap_minutes integer default 30)
returns integer
language sql
as $$
  with counted as (
    insert into public.sheet_visits (sketch_id, device_key, visit_count, first_seen_at, last_seen_at)
    values (p_sketch, left(p_device, 40), 1, now(), now())
    on conflict (sketch_id, device_key) do update
      set visit_count = case
            when public.sheet_visits.last_seen_at < now() - make_interval(mins => p_gap_minutes)
            then public.sheet_visits.visit_count + 1
            else public.sheet_visits.visit_count
          end,
          last_seen_at = case
            when public.sheet_visits.last_seen_at < now() - make_interval(mins => p_gap_minutes)
            then now()
            else public.sheet_visits.last_seen_at
          end
      returning *
  )
  select visit_count from counted;
$$;
--SPLIT--
revoke all on function public.register_sheet_visit(integer, text, integer) from public, anon, authenticated;
--SPLIT--
grant execute on function public.register_sheet_visit(integer, text, integer) to service_role;
