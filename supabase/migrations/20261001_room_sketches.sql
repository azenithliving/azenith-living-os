-- The store can read a hand-drawn room now — but the reading had nowhere to live. Measured
-- before this file: no table for sketches exists under any of the names the code or the plan
-- papers use (room_sketches, sketches, floor_plans, cad_uploads), so the paper reader's answer
-- would have been computed and thrown away, and the customer's design passport would have had
-- no plan to show.
--
-- One row is one reading, not one room: the same paper can be read twice with a different
-- second witness, and the row that says `ok = false` is kept on purpose. A refused reading is
-- evidence about the paper, and the owner is entitled to see why the machine stopped.
--
-- Row level security is switched on with no permissive policy: nothing outside the store's own
-- service reaches this table. The public passport page will ask for a token-scoped read in its
-- own migration, when it exists — not before.
--SPLIT--
create table if not exists public.room_sketches (
  id bigint generated always as identity primary key,
  company_id uuid,
  customer_key text,
  image_path text,
  room text,
  dimensions jsonb not null default '[]'::jsonb,
  openings jsonb not null default '[]'::jsonb,
  area_sqm numeric,
  confirmed_count integer not null default 0,
  ok boolean not null default false,
  failure text,
  witnesses jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
--SPLIT--
create index if not exists room_sketches_company_created_idx
  on public.room_sketches (company_id, created_at desc);
--SPLIT--
alter table public.room_sketches enable row level security;
--SPLIT--
-- The bucket stores an object path, not a link: `customer-uploads` is private and the
-- purge cron deletes by path. A column called `image_url` holding a path is a lie that
-- the next reader would have to discover.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'room_sketches' and column_name = 'image_url'
  ) then
    alter table public.room_sketches rename column image_url to image_path;
  end if;
end $$;
