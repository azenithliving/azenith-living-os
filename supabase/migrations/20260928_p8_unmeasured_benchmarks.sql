-- P8 — the benchmark ledger stops pretending a missing reading is a zero.
--
-- Measured on this database before the guard shipped: of 75 rows stored under
-- benchmark_key 'luxury_score', 61 hold score 0 while the swarm's last real
-- reading was 88. Every one of those 61 has a JSON-null details->luxuryScore, i.e.
-- the extraction found no number and the writer stored 0 anyway. A row with a real
-- reading always carries its sub-scores object, so this predicate cannot reach a
-- genuine measurement: it matched 61 of 75 rows and left the 14 real readings
-- (88, 82, 78, ...) under their original key.
--
-- The rows are not deleted. Deleting the evidence would hide the fact that the
-- swarm reported a number it had not measured 61 times; re-keying keeps the run,
-- its timestamp and its prose in the table while taking it out of the metric
-- series the studio card reads. Re-applying this finds no matching row.

UPDATE public.ops_benchmark_runs
   SET benchmark_key = 'luxury_score_unmeasured'
 WHERE benchmark_key = 'luxury_score'
   AND score = 0
   AND (details ->> 'luxuryScore') IS NULL;

-- PostgREST caches the table's schema; reload so the API reads the same truth.
NOTIFY pgrst, 'reload schema';
