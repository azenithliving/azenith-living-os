-- 20261008_a_user_area.sql
-- The area the customer named for himself, on the record his conversation already owns.
--
-- Measured 2026-10-08: the region station ranks a customer's pictures by the taste of his area, and
-- the only place an area is written is his sheet's delivery desk. In the store's own 145 conversations,
-- 25 of them carry an area in the customer's words («أنا بجهز شقة ١٨٠ متر في التجمع») and none of it is
-- recorded anywhere — the store hears the map and throws it away.
--
-- Nullable by design, and never guessed: a conversation that names no area keeps the column empty, and
-- an area said by the store itself (its coverage answer lists every district) must never reach it.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'area'
  ) then
    alter table public.users add column area text;
    comment on column public.users.area is
      'المنطقة كما قالها العميل في كلامه هو — مش في كلام الدار';
  end if;
end $$;
