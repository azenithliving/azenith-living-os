/**
 * Read-only: what can a "best picture for this room" order actually be built from?
 *
 * The bank's `quality_score` measured 0.00 in all 7,805 rows, so ordering by it returns whatever the
 * database feels like — which is the same instability the home page has today from the other direction.
 * This checks the fields that could carry a real ranking: display_order, the harvested dimensions in
 * metadata, and how many rows per room type and style.
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
    select count(*)::int as rows,
           count(*) filter (where display_order is not null) as has_order,
           count(distinct display_order)::int as distinct_orders,
           min(display_order)::int as min_order,
           max(display_order)::int as max_order,
           count(*) filter (where quality_score is not null and quality_score > 0) as scored,
           count(*) filter (where metadata ? 'width') as has_width,
           count(*) filter (where (metadata->>'width')::int >= 1000) as wide_1000plus
      from public.curated_images`;
  console.log(JSON.stringify(shaped[0]));

  const orders = await sqlClient`
    select display_order, count(*)::int as n from public.curated_images
     group by display_order order by n desc limit 8`;
  console.log(`\ndisplay_order values: ${orders.map((o) => `${o.display_order}=${o.n}`).join(", ")}`);

  const perType = await sqlClient`
    select room_type, count(*)::int as n, count(distinct style)::int as styles,
           max((metadata->>'width')::int)::int as widest
      from public.curated_images where is_active group by room_type order by n desc`;
  console.log(`\nroom_type · rows · styles · widest`);
  for (const r of perType) console.log(`  ${String(r.room_type).padEnd(24)} ${String(r.n).padStart(5)} ${r.styles} ${r.widest ?? "—"}`);

  const meta = await sqlClient`
    select jsonb_object_keys(metadata) as k, count(*)::int as n
      from public.curated_images group by k order by n desc limit 12`;
  console.log(`\nmetadata keys: ${meta.map((m) => `${m.k}=${m.n}`).join(", ")}`);
} catch (error) {
  console.error("Census failed:", error?.message ?? error);
  process.exit(1);
} finally {
  await sqlClient.end();
}
