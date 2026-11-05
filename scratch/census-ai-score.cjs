/**
 * Read-only: what shape is the harvested `ai_score`, and what type is the bank's id?
 *
 * The cover picker wants to order by the score the harvester wrote into metadata for about two of
 * every five pictures. A cast in SQL is only safe if every value in there is a number, so this checks
 * the shape before anything is written, instead of discovering it as a 500 on the storefront.
 */
const dotenv = require("dotenv");
const path = require("path");
const postgres = require("postgres");

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

(async () => {
  const cols = await sql`
    select column_name, data_type from information_schema.columns
     where table_schema = 'public' and table_name = 'curated_images'
     order by ordinal_position`;
  console.log("columns:", cols.map((c) => `${c.column_name}:${c.data_type}`).join(", "));

  const types = await sql`
    select jsonb_typeof(metadata -> 'ai_score') as t, count(*)::int as n
      from public.curated_images where metadata ? 'ai_score' group by 1`;
  console.log("ai_score json types:", JSON.stringify(types));

  const values = await sql`
    select metadata ->> 'ai_score' as v, count(*)::int as n
      from public.curated_images where metadata ? 'ai_score'
     group by 1 order by n desc limit 6`;
  console.log("top values:", values.map((s) => `${s.v}=${s.n}`).join(", "));

  const bad = await sql`
    select count(*)::int as n from public.curated_images
     where metadata ? 'ai_score' and (metadata ->> 'ai_score') !~ '^[0-9]+(\\.[0-9]+)?$'`;
  console.log("non-numeric ai_score rows:", bad[0].n);

  const perType = await sql`
    select room_type,
           count(*)::int as rows,
           count(*) filter (where metadata ? 'ai_score') as scored,
           max((case when (metadata ->> 'ai_score') ~ '^[0-9]+(\\.[0-9]+)?$' then (metadata ->> 'ai_score')::numeric end)) as best
      from public.curated_images where is_active group by room_type order by rows desc`;
  console.log("room_type · rows · scored · best score:");
  for (const r of perType) console.log(`  ${String(r.room_type).padEnd(24)} ${String(r.rows).padStart(5)} ${String(r.scored).padStart(5)} ${r.best ?? "—"}`);
})()
  .catch((e) => {
    console.error("measure failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
