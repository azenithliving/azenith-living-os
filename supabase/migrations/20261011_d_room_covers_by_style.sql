-- The cover must answer to the style being shown.
--
-- `pick_room_covers(text[])` (20261011_c) returns one picture per room type. Measured the same hour:
-- the storefront has a style switcher — modern, scandinavian, classic, industrial — and it already asks
-- the external service for «luxury interior design <room>» in the style the visitor chose. One cover per
-- room would promise «مودرن» and show «كلاسيك», which is the wrong-picture-in-the-right-card failure
-- this store's owner asked to be rid of.
--
-- This is a second function beside the first, not a rewrite of it: Postgres refuses to change an
-- existing function's return type, and dropping one is a delete in the database, which is the owner's
-- word to give and not this agent's to take. So the room-and-style answer lives under its own
-- signature — `(text[], text)` — and the earlier one stays exactly as it was applied.
--
-- Measured on the live bank: 38 (room, style) cells exist across the ten room types the bank holds —
-- nine carry all four styles, kitchen carries modern and classic only. `p_style` null asks for every
-- style in one round trip; a room or style the bank does not hold is simply absent from the answer, so
-- the caller keeps its named fallback instead of dressing a bathroom card in a whole-house picture.
--
-- The order is unchanged: the harvester's score where it exists (3,036 of 7,805 rows carry one), then
-- the bank's own harvest slot, then the id — so the same cell answers the same picture every request.
--
-- Nothing here deletes or changes any row.
--SPLIT--
create or replace function public.pick_room_covers(p_types text[], p_style text)
returns table (out_room_type text, out_style text, out_image_id bigint, out_url text, out_score numeric)
language sql
stable
as $$
  select distinct on (c.room_type, c.style)
         c.room_type,
         c.style,
         c.id,
         c.url,
         (c.metadata ->> 'ai_score')::numeric
    from public.curated_images as c
   where c.is_active
     and c.url is not null
     and c.room_type = any (p_types)
     and (p_style is null or c.style = p_style)
   order by c.room_type,
            c.style,
            (c.metadata ->> 'ai_score')::numeric desc nulls last,
            c.display_order asc,
            c.id asc;
$$;
--SPLIT--
revoke all on function public.pick_room_covers(text[], text) from public, anon, authenticated;
--SPLIT--
grant execute on function public.pick_room_covers(text[], text) to service_role;
