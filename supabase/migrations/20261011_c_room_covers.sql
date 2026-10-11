-- One picture per room, chosen the same way every time.
--
-- Measured 2026-10-11: the storefront asks an external photo service for a picture of each room on
-- every visit, with a random page offset in the query, so the same room shows a different picture to
-- two visitors and a different one again on reload — while the store's own bank holds 7,805 active
-- pictures in ten room types, all of them answering 200 when probed.
--
-- The bank's `quality_score` column is 0.00 in all 7,805 rows, so it ranks nothing (and
-- `lib/cad/sheet-images.ts` already orders by it and gets an arbitrary answer). What does hold a real
-- verdict is the score the harvester wrote into `metadata.ai_score`: present on 3,036 rows, numeric on
-- every one of them, and unevenly spread across room types (kitchen 460 of 460, master-bedroom 23 of
-- 1,301, living-room and dining-room and teen-room none at all). So the order is: the score where it
-- exists, then the harvest slot the bank already keeps, then the id — a pick that is the best available
-- reading and, above all, the same picture on every request.
--
-- Rooms the bank does not hold are simply absent from the answer. That is deliberate: a bathroom card
-- filled from the general house set would be a picture of something else wearing the bathroom's name.
-- The caller keeps its named fallback for those and says which rooms came from the bank.
--
-- Nothing here deletes or changes any row.
--SPLIT--
create or replace function public.pick_room_covers(p_types text[])
returns table (out_room_type text, out_image_id bigint, out_url text, out_style text, out_score numeric)
language sql
stable
as $$
  select distinct on (c.room_type)
         c.room_type,
         c.id,
         c.url,
         c.style,
         (c.metadata ->> 'ai_score')::numeric
    from public.curated_images as c
   where c.is_active
     and c.url is not null
     and c.room_type = any (p_types)
   order by c.room_type,
            (c.metadata ->> 'ai_score')::numeric desc nulls last,
            c.display_order asc,
            c.id asc;
$$;
--SPLIT--
revoke all on function public.pick_room_covers(text[]) from public, anon, authenticated;
--SPLIT--
grant execute on function public.pick_room_covers(text[]) to service_role;
