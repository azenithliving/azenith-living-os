/**
 * Read-only census for the fifteen section pictures: what is stored, what actually loads, and where
 * the store already keeps images that do load.
 *
 * Measured 2026-10-09: every one of the fifteen sections points at the same address and that address
 * answers 404. Before touching a single row, the question is whether the store holds real pictures
 * somewhere else — because if it does, the sections are pointing at the wrong owner of the fact.
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const sqlClient = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

async function probe(url) {
  if (!url) return "no url";
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return `${res.status}${res.headers.get("content-length") ? ` ${Math.round(Number(res.headers.get("content-length")) / 1024)}kB` : ""}`;
  } catch (error) {
    return `fetch failed (${error?.cause?.code ?? "unknown"})`;
  }
}

try {
  const sections = await sqlClient`
    select id, name, slug, image_url, is_active, display_order
      from public.room_sections order by display_order`;
  const distinct = [...new Set(sections.map((s) => s.image_url))];
  console.log(`room_sections rows = ${sections.length} · distinct image_url = ${distinct.length}`);
  for (const url of distinct) console.log(`  probe ${String(url).slice(0, 90)} → ${await probe(url)}`);

  for (const table of ["curated_images", "media_assets", "images"]) {
    const cols = await sqlClient`
      select column_name from information_schema.columns
       where table_schema='public' and table_name=${table} order by ordinal_position`;
    if (cols.length === 0) { console.log(`\n${table}: no such table`); continue; }
    const names = cols.map((c) => c.column_name);
    const [{ n }] = await sqlClient`select count(*)::int as n from public.${sqlClient(table)}`;
    console.log(`\n## ${table} rows=${n} columns=${names.join(",")}`);
    if (n === 0) continue;
    // The table list above is written here, never taken from input, so interpolating the name is safe.
    const rows = await sqlClient.unsafe(`select * from public.${table} limit 6`);
    for (const row of rows) {
      const url = names.map((k) => row[k]).find((v) => typeof v === "string" && /^https?:\/\//.test(v));
      const group = names.find((k) => /room|category|tag|page|section|keyword/i.test(k));
      console.log(`  ${group ? `${String(row[group]).slice(0, 24)} · ` : ""}${String(url ?? "(no url field)").slice(0, 78)} → ${await probe(url)}`);
    }
  }
} catch (error) {
  console.error("Census failed:", error?.message ?? error);
  process.exit(1);
} finally {
  await sqlClient.end();
}
