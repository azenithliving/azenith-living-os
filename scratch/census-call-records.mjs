/**
 * Read-only: is there a real record of provider calls anywhere, so the card that says
 * "API success rate" can be computed from data instead of from the alert log's own shape?
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const rest = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sqlClient = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

const names = ["api_usage_log", "execution_logs", "ops_swarm_events", "ops_sync_events", "audit_logs"];

try {
  for (const name of names) {
    const cols = await sqlClient`
      select column_name, data_type from information_schema.columns
       where table_schema = 'public' and table_name = ${name} order by ordinal_position`;
    if (cols.length === 0) {
      console.log(`\n## ${name}: no such table`);
      continue;
    }
    const { count, error } = await rest.from(name).select("*", { count: "exact", head: true });
    console.log(`\n## ${name} rows=${error ? `unreadable (${error.code})` : count}`);
    console.log(`   columns: ${cols.map((c) => `${c.column_name}:${c.data_type}`).join(", ")}`);
    const newest = await sqlClient`
      select created_at::text as at from public.${sqlClient(name)}`.then(() => null).catch(() => null);
    void newest;
  }

  // The newest row in each table that could hold a provider call, so we know if it is live.
  const perTable = await sqlClient.unsafe(`
    select 'api_usage_log' as t, max(created_at)::text as newest, count(*)::int as n from public.api_usage_log
    union all select 'execution_logs', max(created_at)::text, count(*)::int from public.execution_logs
    union all select 'ops_swarm_events', max(created_at)::text, count(*)::int from public.ops_swarm_events`);
  for (const r of perTable) console.log(`\nliveness ${r.t}: rows=${r.n} newest=${r.newest}`);
} catch (error) {
  console.error("Census failed:", error?.message ?? error);
  process.exit(1);
} finally {
  await sqlClient.end();
}
