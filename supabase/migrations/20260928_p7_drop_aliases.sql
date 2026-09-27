-- P7-T12 — the retired table names stop existing at all.
--
-- P7-M5 renamed the swarm's fifteen tables to `ops_*` and left each retired name
-- standing as a security-invoker view over its successor, so a stale tab or an
-- un-migrated reader could not fail mid-sentence. That window is now closed on
-- evidence, not on a guess:
--
--   · the first scheduled round on the renamed path landed — `context_update` by
--     `ops-lead` at 2026-09-27 07:00:07 UTC, and the manual production suite runs
--     entirely against `ops_*` names;
--   · `tests/ops/toolNames.test.ts` fails the build if any shipped file queries a
--     `qayyim_*` relation, and it is green at this commit;
--   · `pg_depend` holds no object depending on any of the fifteen views, so the drop
--     needs no CASCADE and cannot quietly take a policy, rule or nested view with it;
--   · every one of them carries `security_invoker = true` in `pg_class.reloptions`,
--     which the block below re-checks before dropping — an owner-checking view would
--     have been an RLS bypass, and it would not be dropped blindly either.
--
-- Idempotent by `drop view if exists`. Recreating any alias is one statement, and
-- the generator that emitted them (`scripts/p7-gen-tables-sql.mjs`) is in the repo.
DO $$
DECLARE
  name text;
  bases text[] := ARRAY[
    'qayyim_benchmark_runs', 'qayyim_drafts', 'qayyim_experiment_events',
    'qayyim_experiments', 'qayyim_goals', 'qayyim_rival_snapshots', 'qayyim_rivals',
    'qayyim_semantic_memory', 'qayyim_suggestions', 'qayyim_swarm_events',
    'qayyim_swarm_learnings', 'qayyim_swarm_tasks', 'qayyim_sync_events',
    'qayyim_task_metrics', 'qayyim_telemetry_events'
  ];
BEGIN
  FOREACH name IN ARRAY bases LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = name AND c.relkind = 'v'
         AND c.reloptions @> ARRAY['security_invoker=true']
    ) THEN
      EXECUTE format('DROP VIEW public.%I', name);
    END IF;
  END LOOP;
END
$$;

-- PostgREST caches the relation list; reload so an API read never sees a dropped name.
NOTIFY pgrst, 'reload schema';
