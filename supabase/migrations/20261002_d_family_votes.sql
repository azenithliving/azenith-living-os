-- «غرفة القرار العائلي»: the family votes on the pictures, on the same secret link.
--
-- The plan asks for the couple or the family to open the customer's own address at the
-- same time and tap like on the pieces they prefer, and for those preferences to land on
-- the owner's sheet. Nothing here needs an account: the token in the address is the whole
-- login, exactly as the design sheet already works, and a voter is named by a short label
-- they type themselves («أنا»، «مراتي»، «أحمد»).
--
-- One row per (sheet, picture, voter) so a second tap changes a mind instead of piling up
-- a number nobody can trust, and `image_url` is kept beside the bank id because the bank
-- can be re-curated while a family's decision must still read the same way.
--
-- Row level security stays on with no policy: this table is only ever reached by the
-- store's own code with the service client, which answers for the one token in the address.
--SPLIT--
create table if not exists public.family_votes (
  id bigint generated always as identity primary key,
  sketch_id integer not null references public.room_sketches (id) on delete cascade,
  image_key text not null,
  image_url text,
  voter text not null,
  liked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sketch_id, image_key, voter)
);
--SPLIT--
alter table public.family_votes enable row level security;
--SPLIT--
-- The owner's desk reads a sheet's votes to show what the family agreed on.
create index if not exists family_votes_sketch_idx on public.family_votes (sketch_id);
--SPLIT--
create or replace function public.touch_family_votes_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
--SPLIT--
drop trigger if exists family_votes_touch_updated on public.family_votes;
--SPLIT--
create trigger family_votes_touch_updated before update on public.family_votes
for each row execute function public.touch_family_votes_updated_at();
