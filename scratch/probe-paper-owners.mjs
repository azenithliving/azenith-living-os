/**
 * Which roll keys actually carry papers, and what spelling the dimension labels hold.
 * Read-only, counts and shapes only — no key values, no phone digits beyond the stored link.
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });
const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

try {
  const links = await sql`
    select customer_key, count(*)::int as papers, max(created_at)::text as newest
      from public.room_sketches group by customer_key order by papers desc`;
  console.log("grouped by owner:");
  for (const r of links) console.log(`  ${String(r.customer_key ?? "(لا أحد)").padEnd(22)} ${r.papers}  آخرها ${r.newest}`);

  const rows = await sql`
    select id, room, dimensions::text as dims, ok, confirmed_at is not null as sealed, image_path is not null as has_photo
      from public.room_sketches order by created_at desc limit 8`;
  console.log("\nnewest papers:");
  for (const r of rows) {
    const labels = [...String(r.dims).matchAll(/"label":"([^"]*)"/g)].map((m) => m[1]);
    console.log(`  #${r.id} room=${String(r.room).slice(0, 28).padEnd(28)} ok=${r.ok} sealed=${r.sealed} photo=${r.has_photo} labels=${labels.join("|")}`);
  }

  const names = await sql`
    select id, full_name from public.users
      where full_name ~ '[A-Za-z]' limit 8`;
  console.log("\nnames carrying Latin:");
  for (const n of names) console.log(`  #${n.id} ${n.full_name}`);
} catch (e) {
  console.error("probe failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
