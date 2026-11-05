const postgres = require("postgres");

/**
 * The bank's cover pick reads the model's score out of the row's metadata, not out of `quality_score`
 * (the migration is explicit about it: the column was 0.00 on all 7,805 rows for months). The harvest
 * wrote the real score into the column; this copies it into the slot the pick actually sorts by, for
 * the rows this run created and no others.
 *
 *   node -r ./scratch/load-env.cjs scratch/bank-cover-score.cjs [--apply]
 */
const APPLY = process.argv.includes("--apply");
const TAG = "room-cover-harvest-2026-10-12";

(async () => {
  const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

  const rows = await sql`
    select id, quality_score::numeric as score, metadata
      from public.curated_images
     where metadata ->> 'harvested_by' = ${TAG}`;
  const missing = rows.filter((r) => r.metadata?.ai_score === undefined || r.metadata?.ai_score === null);
  console.log(`صفوف اللفة: ${rows.length} · ناقصة درجة في الميتاداتا: ${missing.length}`);

  if (APPLY && missing.length) {
    for (const r of missing) {
      await sql`
        update public.curated_images
           set metadata = metadata || ${{ ai_score: Number(r.score) }}::jsonb
         where id = ${r.id}`;
    }
    const back = await sql`
      select count(*)::int n from public.curated_images
       where metadata ->> 'harvested_by' = ${TAG} and (metadata ->> 'ai_score') is not null`;
    console.log(`بالقراية من القاعدة: ${back[0].n} من ${rows.length} عندها درجة يقرأها اختيار الغلاف`);
  } else if (!APPLY) {
    console.log("ده قياس بس. للكتابة زوّد --apply");
  }
  await sql.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
