/**
 * Read-only: what fact does `system_telemetry` actually hold?
 *
 * 1380 rows already sit in a table whose columns are component/status/latency — close enough in
 * shape to an alert that we must not add a second home for the same fact. This prints the distinct
 * components and statuses plus the newest rows, so the decision is made from data, not from a name.
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const sqlClient = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

try {
  const byComponent = await sqlClient`
    select component, status, count(*)::int as n, max(created_at)::text as newest
      from public.system_telemetry group by 1,2 order by n desc limit 25`;
  console.log(`distinct component+status = ${byComponent.length}`);
  for (const r of byComponent) {
    console.log(`  ${r.component} / ${r.status} -> ${r.n} (newest ${r.newest})`);
  }

  const samples = await sqlClient`
    select component, status, latency_ms, left(metadata::text, 220) as meta, created_at::text
      from public.system_telemetry order by created_at desc limit 5`;
  for (const s of samples) {
    console.log(`\nsample: ${s.component} ${s.status} ${s.latency_ms}ms ${s.created_at}`);
    console.log(`  meta: ${s.meta}`);
  }
} catch (error) {
  console.error("Census failed:", error?.message ?? error);
  process.exit(1);
} finally {
  await sqlClient.end();
}
