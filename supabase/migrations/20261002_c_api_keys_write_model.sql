-- The model a key is allowed to use belongs to the key, not to the code.
--
-- Measured with the owner's own new keys on 2026-10-02: the model name this store had been
-- sending to one provider comes back «does not exist or you do not have access», while the
-- same key writes fine with a different name it listed for itself. A hardcoded model is a
-- guess about somebody else's account, and when it goes stale every request to that provider
-- fails — including the requests the owner pays nothing for.
--
-- So the verifier records the model that actually answered, and the picker hands it to the
-- caller with the key.
--SPLIT--
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'api_keys' and column_name = 'write_model'
  ) then
    alter table public.api_keys add column write_model text;
  end if;
end $$;
--SPLIT--
-- Only providers with a key that wrote are worth loading into the rotation.
create index if not exists api_keys_provider_writes_idx
  on public.api_keys (provider, write_model)
  where write_model is not null;
