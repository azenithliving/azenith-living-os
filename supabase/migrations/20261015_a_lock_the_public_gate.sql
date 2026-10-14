-- 20261015_a_lock_the_public_gate.sql
--
-- The store's record answers to the store's own credential, and to nobody standing outside it.
--
-- Measured 2026-10-15 by scratch/census-the-database-gate.mjs and scratch/which-doors-read-with-the-
-- public-key.mjs, run against the published project with nothing but the key the browser already
-- ships (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, a public value by Supabase's own design):
--
--   · 69 of the 155 tables in `public` handed rows to that key. Among them `users` (staff names,
--     emails, phones), `leads` and `_p6_backup_leads` (customers' names, emails and messages),
--     `agent_messages` (1,741 rows of the owner's own conversation with his employees),
--     `consultant_sessions` (147 customer conversations), `login_tokens`, `client_access`,
--     `companies` (the store's own WhatsApp number), `sales_orders`, `elite_sessions`, and every
--     `_p6_backup_*` / `_p7_backup_*` copy of the same rows.
--   · `public.execute_sql(text)` is SECURITY DEFINER, owned by `postgres` (which stands outside row
--     level security), and EXECUTE was granted to `anon` and `authenticated`. Proved live: a stranger's
--     call with `select pg_sleep(2)` answered 204 after 2,266 ms, and a statement that cannot parse
--     answered 42601 — a Postgres error, which is the sentence that says the text was executed.
--   · The reason the store's own doors answered at all was the policies: 100 of them, written
--     `to public ... using (true)`, which is the same sentence as «open to the street».
--
-- Two locks, one after the other. The policies are left exactly where they are: with the privileges
-- gone and row level security on everywhere, they answer nothing — and nothing of the owner's record
-- is deleted by this file, which is also what makes the way back one statement long.
--
-- THE WAY BACK (documented, not run):
--   grant all on all tables in schema public to anon, authenticated;
--   grant all on all sequences in schema public to anon, authenticated;
--   grant all on all functions in schema public to anon, authenticated;
--   alter default privileges in schema public grant all on tables to anon, authenticated;
--   alter default privileges in schema public grant all on sequences to anon, authenticated;
--   alter default privileges in schema public grant all on functions to anon, authenticated;
-- Before walking it, the doors have to be moved back off `lib/supabase-admin`'s credential first —
-- which is the state the store was in until today, and the state today's measurement refuses.

--SPLIT--

-- 1. The two public roles lose their privileges on everything the store keeps: tables, the counters
--    behind them, and the stored functions. `service_role` is not named here on purpose — it is the
--    credential the store's own doors carry, it holds its own grants, and it stands outside row level
--    security (measured: `rolbypassrls = true`), so every surface keeps answering.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

--SPLIT--

-- 2. A table created after today must not reopen the gate by default. Without these three lines the
--    project's own default privileges hand the next table to the same two roles, which is how 71 of
--    today's 155 tables ended up with no gate on them at all.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

--SPLIT--

-- 3. The second lock, so a re-grant cannot be the only thing standing between a stranger and the
--    record: row level security switched on wherever there was none. With no policy admitting the
--    public roles, a visitor reading such a table is answered with nothing — and `service_role`,
--    which bypasses it, never notices the difference.
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
    order by c.relname
  loop
    execute format('alter table %I.%I enable row level security', 'public', r.relname);
  end loop;
end
$$;
