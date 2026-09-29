-- The conversion ledger has never held a row, and this is why: its key is chained to
-- visitor_sessions, a table with zero rows that no file in the store writes to. Any
-- attempt to record «this visitor became a contact» is rejected by the database.
-- Re-chain it to the conversation that produced the contact. consultant_sessions
-- .session_id carries a unique index (verified against the live schema on
-- 2026-09-30, with zero duplicated keys), so the constraint is legal, and
-- ON DELETE CASCADE keeps it consistent with the customers delete door, which already
-- sweeps conversations.
--
-- Nothing here deletes a row. lead_conversions is empty at the time of writing; if it
-- ever held a row pointing at visitor_sessions, the added constraint would fail loudly
-- rather than quietly discard it.
--SPLIT--
alter table public.lead_conversions
  drop constraint if exists lead_conversions_session_id_fkey;
--SPLIT--
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'lead_conversions_session_id_fkey'
       and conrelid = 'public.lead_conversions'::regclass
  ) then
    alter table public.lead_conversions
      add constraint lead_conversions_session_id_fkey
      foreign key (session_id)
      references public.consultant_sessions (session_id)
      on delete cascade;
  end if;
end $$;
