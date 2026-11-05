/**
 * Read-only: what does the key desk actually hold, per provider and per recorded verdict?
 *
 * The watcher has a sentence for "a provider is failing" but nothing ever measures it. The key desk
 * already stores the provider's own verdict per key in `check_state`, so the honest source for that
 * alert exists. This prints the census so the alert can be written from a number, not an impression.
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const sqlClient = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

try {
  const cols = await sqlClient`
    select column_name, data_type from information_schema.columns
     where table_schema = 'public' and table_name = 'api_keys' order by ordinal_position`;
  console.log(`api_keys columns: ${cols.map((c) => `${c.column_name}:${c.data_type}`).join(", ")}`);

  const grid = await sqlClient`
    select provider, coalesce(check_state,'(null)') as state, count(*)::int as n
      from public.api_keys group by 1,2 order by 1,3 desc`;
  console.log(`\nprovider x state rows = ${grid.length}`);
  for (const r of grid) console.log(`  ${r.provider} / ${r.state} -> ${r.n}`);

  const totals = await sqlClient`
    select count(*)::int as total,
           count(*) filter (where check_state in ('refused','quota')) as bad,
           max(last_checked_at)::text as newest_check
      from public.api_keys`;
  console.log(`\ntotal=${totals[0].total} refusedOrQuota=${totals[0].bad} newestCheck=${totals[0].newest_check}`);
} catch (error) {
  console.error("Census failed:", error?.message ?? error);
  process.exit(1);
} finally {
  await sqlClient.end();
}
