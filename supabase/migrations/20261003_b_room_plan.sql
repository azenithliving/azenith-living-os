-- The paper's numbers became a drawing in `lib/cad/plan.ts`. A drawing that is recomputed by
-- whoever reads it is not one drawing: the customer's sheet, the owner's desk and the pre-call
-- file would each walk the room their own way. The council's ruling is stored here — the geometry
-- lives on the paper's own row, one-to-one, in a single structured field.
--
-- Deliberately NOT a new table: two rows for one paper means two sheets that can disagree while
-- the customer is still looking at the first, and ending that argument is why this feature
-- exists at all.
--
-- `plan` holds {shape, unit, walls, openings, areaSqm, complete, conflicts}. Each wall carries the
-- witness its number had, so a sheet can draw what was agreed solid and what is only proposed
-- dashed. The seal in `frozen_hash` stays over the agreed NUMBERS alone — dragging a door along
-- its wall must never invalidate a signature, which is the property this column exists to keep.
--SPLIT--
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'room_sketches' and column_name = 'plan'
  ) then
    alter table public.room_sketches add column plan jsonb;
  end if;
end $$;
