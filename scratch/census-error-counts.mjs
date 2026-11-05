/**
 * Read-only: does `api_keys.error_count` hold real recorded failures, and for whom?
 *
 * The watcher's api sentence talks about "failed attempts". That noun only belongs in an alert if
 * some code actually counted attempts. This prints the distribution so the alert is written from the
 * column's real contents — or not written at all.
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const sqlClient = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

try {
  const shaped = await sqlClient`
    select count(*)::int as total,
           count(*) filter (where error_count is not null) as has_count,
           count(*) filter (where coalesce(error_count,0) > 0) as above_zero,
           count(*) filter (where coalesce(error_count,0) >= 3) as three_or_more,
           max(error_count)::int as max_errors
      from public.api_keys`;
  console.log(`error_count census: ${JSON.stringify(shaped[0])}`);

  const byProvider = await sqlClient`
    select provider, count(*)::int as keys_three_plus, max(error_count)::int as worst,
           max(last_checked_at)::text as newest_check
      from public.api_keys
     where coalesce(error_count,0) >= 3
     group by provider order by keys_three_plus desc limit 15`;
  console.log(`\nproviders with keys at 3+ recorded failures = ${byProvider.length}`);
  for (const r of byProvider) console.log(`  ${r.provider}: ${r.keys_three_plus} keys, worst=${r.worst}, newestCheck=${r.newest_check}`);

  const sample = await sqlClient`
    select provider, error_count, left(coalesce(last_error,''),90) as last_error
      from public.api_keys where coalesce(error_count,0) >= 3
     order by error_count desc limit 6`;
  console.log(`\nsamples:`);
  for (const s of sample) console.log(`  ${s.provider} count=${s.error_count} error="${s.last_error}"`);

  const written = await sqlClient`
    select provider, count(*)::int as n from public.api_keys
     where check_state = 'writes' group by provider order by n desc`;
  console.log(`\nproviders whose keys were proven to write: ${written.map((w) => `${w.provider}=${w.n}`).join(", ")}`);
} catch (error) {
  console.error("Census failed:", error?.message ?? error);
  process.exit(1);
} finally {
  await sqlClient.end();
}
