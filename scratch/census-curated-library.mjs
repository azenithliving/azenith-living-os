/**
 * Read-only census of the curated picture library: what rooms it actually covers, how many live
 * pictures each room has, and whether the addresses answer.
 *
 * The customer home page currently asks an external photo service on every visit, with a random page
 * offset, while the store's own library holds thousands of scored pictures. Before proposing that the
 * library become the source, the question is what it really covers — a room with zero live pictures
 * must be named, not papered over.
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const sqlClient = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

async function probe(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.status;
  } catch {
    return 0;
  }
}

try {
  const shaped = await sqlClient`
    select count(*)::int as rows,
           count(*) filter (where is_active) as active,
           count(distinct room_type)::int as room_types,
           count(distinct style)::int as styles,
           max(quality_score)::int as best_score,
           max(created_at)::text as newest,
           max(updated_at)::text as touched
      from public.curated_images`;
  console.log(`curated_images: ${JSON.stringify(shaped[0])}`);

  const byRoom = await sqlClient`
    select room_type, count(*)::int as n,
           count(*) filter (where is_active) as active,
           count(*) filter (where is_active and quality_score >= 70) as good,
           round(avg(quality_score))::text as avg_score
      from public.curated_images group by room_type order by n desc`;
  console.log(`\nroom_type coverage = ${byRoom.length}`);
  for (const r of byRoom) {
    console.log(`  ${String(r.room_type).padEnd(18)} rows=${String(r.n).padStart(5)} active=${String(r.active).padStart(5)} good=${String(r.good).padStart(5)} avg=${r.avg_score ?? "—"}`);
  }

  const sources = await sqlClient`
    select coalesce(source,'(null)') as source, count(*)::int as n,
           count(*) filter (where is_active) as active
      from public.curated_images group by 1 order by n desc limit 10`;
  console.log(`\nsources:`);
  for (const s of sources) console.log(`  ${s.source} rows=${s.n} active=${s.active}`);

  // Do the stored addresses actually load? Sample the best-ranked active picture of each room type.
  const sample = await sqlClient`
    select distinct on (room_type) room_type, style, url, quality_score
      from public.curated_images
     where is_active and url is not null
     order by room_type, quality_score desc nulls last, updated_at desc`;
  console.log(`\nlive probe of one best picture per room type = ${sample.length}`);
  let ok = 0;
  for (const row of sample) {
    const status = await probe(row.url);
    if (status === 200) ok += 1;
    console.log(`  ${String(row.room_type).padEnd(18)} ${status} · score=${row.quality_score ?? "—"} · ${String(row.url).slice(0, 62)}`);
  }
  console.log(`\nanswering 200 = ${ok} of ${sample.length}`);
} catch (error) {
  console.error("Census failed:", error?.message ?? error);
  process.exit(1);
} finally {
  await sqlClient.end();
}
