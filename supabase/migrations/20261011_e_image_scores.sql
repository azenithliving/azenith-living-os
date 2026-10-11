-- Move the picture verdict into the column that ranks by it.
--
-- Measured 2026-10-11: `quality_score` is 0.00 in all 7,805 rows of the picture bank, while the
-- verdict the harvester asked for anyway sits in `metadata.ai_score` on 3,036 of them — numeric on
-- every one, and no other writer has ever touched the column, so there is no competing scale to
-- reconcile. Anything that orders by quality therefore gets an arbitrary answer: `pickSheetImages`
-- does exactly that, and on 5 of the 10 room types the first picture a customer is shown is not the
-- best-scored picture that room holds (corner-sofa shows a 90 while it has a 100, kitchen 92 against
-- 100, dressing-room 90 against 95, master-bedroom and children-room show an unscored row against a
-- 95 and an 85).
--
-- This is a copy, not a judgement: no score is invented, no row is removed, and the metadata keeps
-- its copy of the number. Rows the harvester never scored stay at 0.00 — which now means plainly
-- "never judged", and the reader's tiebreak makes those rooms still answer the same picture every
-- time instead of a different one per reload.
--
-- Three rooms (living, dining, teen) hold no scored picture at all; the sheet cannot rank what nobody
-- rated, and now says so through the order it falls back to rather than pretending.
--SPLIT--
update public.curated_images
   set quality_score = (metadata ->> 'ai_score')::numeric
 where metadata ? 'ai_score'
   and (metadata ->> 'ai_score') ~ '^[0-9]+(\.[0-9]+)?$'
   and coalesce(quality_score, 0) = 0;
