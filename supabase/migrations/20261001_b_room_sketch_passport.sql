-- The second witness is the customer, not a machine that cannot run here.
--
-- Measured twice — once in development, once on the published site with a full
-- minute of budget — the offline digit engine never finished inside a request
-- handler, while the same engine reads the same image in about four seconds outside
-- it. The confirmation rule therefore needs a witness that does exist: the numbers
-- the customer types himself for his own room. That is also the witness the owner
-- asked for from the beginning — a sheet both sides agreed on, so there is nothing to
-- argue about later.
--
-- `token` is what the customer's private page is reached by: 24 random characters,
-- unique, no account and no password. `frozen_hash` seals the exact numbers that were
-- agreed, so a later edit of the reading cannot quietly change what was approved.
--
-- Row level security stays on with no policy: the public page is served by the store's
-- own code, which reads this table with the service client and answers only for the one
-- token in the address.
--SPLIT--
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'room_sketches' and column_name = 'token'
  ) then
    alter table public.room_sketches add column token text unique;
  end if;
end $$;
--SPLIT--
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'room_sketches' and column_name = 'customer_dimensions'
  ) then
    alter table public.room_sketches add column customer_dimensions jsonb;
  end if;
end $$;
--SPLIT--
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'room_sketches' and column_name = 'confirmed_at'
  ) then
    alter table public.room_sketches add column confirmed_at timestamptz;
  end if;
end $$;
--SPLIT--
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'room_sketches' and column_name = 'frozen_hash'
  ) then
    alter table public.room_sketches add column frozen_hash text;
  end if;
end $$;
--SPLIT--
-- Tokens are looked up straight from the address bar; without this the whole table is
-- scanned for every visitor who opens a link.
create index if not exists room_sketches_token_idx on public.room_sketches (token);
