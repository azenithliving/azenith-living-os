-- The customer's colour matrix needed a place, and the ruling that settled the drawing settles
-- this too: one structured field on the paper's own row, no second table. A sheet and its colours
-- are one thing, and two rows for one paper is how a screen starts disagreeing with itself.
--
-- `colour_picks` holds up to three {family, hex} pairs — the hex being a colour the store's own
-- pictures carry, not a word he typed. The bank stores one measured colour per picture
-- (`metadata.avg_color`, present on 5,909 active pictures), so a pick can always be traced back to
-- photographs the shop can actually show him.
--SPLIT--
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'room_sketches' and column_name = 'colour_picks'
  ) then
    alter table public.room_sketches add column colour_picks jsonb;
  end if;
end $$;
