-- The key desk needs two facts the pool never held: when a key was last asked whether it
-- lives, and what it answered. Until now the answer was buried in a free-text note written
-- by a script, which means the screen was parsing prose to count keys — and prose changes.
--
-- `check_state` is the provider's own verdict, recorded, not inferred:
--   alive        the company answered 200 to a request that costs no tokens
--   quota        the key is valid and its free ceiling is spent right now
--   refused      the company said no to this key (revoked, unpaid, or a team never activated)
--   unreachable  the request did not finish; nothing was concluded, and the row was left alone
--   unwritten    no check is defined for this provider yet
--
-- `notes` keeps its old job: provenance — who put the row here and why.
--
-- Nothing is deleted and no key value is touched.
--SPLIT--
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'api_keys' and column_name = 'check_state'
  ) then
    alter table public.api_keys add column check_state text;
  end if;
end $$;
--SPLIT--
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'api_keys' and column_name = 'last_checked_at'
  ) then
    alter table public.api_keys add column last_checked_at timestamptz;
  end if;
end $$;
--SPLIT--
-- The desk groups by state for every provider on one press.
create index if not exists api_keys_provider_check_state_idx
  on public.api_keys (provider, check_state);
--SPLIT--
-- The verdicts the scripts already wrote are read back into the column they belong in, so
-- the desk does not start from zero on keys that were checked today.
update public.api_keys
   set check_state = case
         when notes like 'verified%alive' then 'alive'
         when notes like 'verified%quota spent now' then 'quota'
         when notes like 'verified%refused by the provider' then 'refused'
         else null
       end,
       last_checked_at = case
         when notes like 'verified%' then updated_at
         else last_checked_at
       end
 where notes like 'verified%'
   and check_state is null;
