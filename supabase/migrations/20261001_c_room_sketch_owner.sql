-- Whose paper is this? The column existed from the first day of the sketches table and has
-- never held a value: measured on the published store on 2026-10-01, 12 readings, 0 linked.
-- A reading with no owner on it cannot be handed to a colleague, and when the customer calls
-- back there is nothing to pull up.
--
-- `customer_key` stores the customer's OWN key from the roll (`phone:<national digits>`,
-- `email:<address>` or `name:<text>`, exactly as `lib/customers/identity.ts` forms it), never
-- a copy of his name or number. So the desk and the roll cannot disagree about who he is: the
-- name, the tier and the history stay in one place and the sketch points at them.
--
-- The index is for the question the shop actually asks — "this number called, what did he
-- draw?" — which without it would scan every reading ever taken.
--SPLIT--
create index if not exists room_sketches_customer_key_idx
  on public.room_sketches (customer_key)
  where customer_key is not null;
