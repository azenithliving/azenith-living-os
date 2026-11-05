/**
 * Read-only: which picture does a customer's sheet show first today, and what did the harvester think
 * of it?
 *
 * The sheet orders by `quality_score`, and that column is 0.00 in every row — so the first picture is
 * whatever the database hands back, not the best one. The score that does exist lives in metadata. This
 * prints, per room, the score of the row that wins today against the best score the room actually
 * holds, so the cost of the empty column is a number and not an opinion.
 */
const dotenv = require("dotenv");
const path = require("path");
const postgres = require("postgres");

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

(async () => {
  const rows = await sql`
    select room_type,
           (array_agg(id order by quality_score desc nulls last, id asc))[1] as first_today,
           ((array_agg(metadata ->> 'ai_score' order by quality_score desc nulls last, id asc))[1]) as score_today,
           max((metadata ->> 'ai_score')::numeric) as best_score,
           count(*) filter (where metadata ? 'ai_score')::int as scored,
           count(*)::int as rows
      from public.curated_images
     where is_active
     group by room_type
     order by room_type`;

  console.log("room_type · first row today (id : its score) · best score in the room · scored/rows");
  for (const r of rows) {
    console.log(
      `  ${String(r.room_type).padEnd(24)} ${String(r.first_today).padStart(9)} : ${String(r.score_today ?? "none").padEnd(6)} · best=${String(r.best_score ?? "none").padEnd(6)} · ${r.scored}/${r.rows}`
    );
  }
  const worse = rows.filter((r) => r.best_score !== null && (r.score_today === null || Number(r.score_today) < Number(r.best_score)));
  console.log(`\nrooms whose first picture is not the best-scored one it has: ${worse.length} of ${rows.length}`);
})()
  .catch((e) => {
    console.error("measure failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
