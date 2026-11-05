/**
 * Read-back of the score backfill: does the row a sheet shows first now carry the room's best score?
 *
 * The order is the one the shipping reader uses — score down, then the bank's harvest slot, then the
 * id — so this measures the answer the customer actually gets, not the column in isolation.
 */
const dotenv = require("dotenv");
const path = require("path");
const postgres = require("postgres");

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

(async () => {
  const shaped = await sql`
    select count(*)::int as rows,
           count(*) filter (where coalesce(quality_score,0) > 0) as scored_now,
           count(*) filter (where metadata ? 'ai_score') as scored_in_metadata,
           max(quality_score)::text as best
      from public.curated_images`;
  console.log("bank:", JSON.stringify(shaped[0]));

  const firsts = await sql`
    select distinct on (room_type) room_type,
           quality_score as first_score,
           max(quality_score) over (partition by room_type) as best_score,
           count(*) over (partition by room_type)::int as rows
      from public.curated_images
     where is_active
     order by room_type, quality_score desc nulls last, display_order asc, id asc`;
  console.log("\nroom_type · first picture's score · best in the room · rows");
  let matching = 0;
  for (const r of firsts) {
    const ok = Number(r.first_score) === Number(r.best_score);
    if (ok) matching += 1;
    console.log(`  ${String(r.room_type).padEnd(24)} ${String(r.first_score).padEnd(6)} ${String(r.best_score).padEnd(6)} ${String(r.rows).padStart(5)} ${ok ? "matches" : "DIFFERS"}`);
  }
  console.log(`\nrooms whose first picture is the best-scored one: ${matching} of ${firsts.length}`);

  const stable = [];
  for (let i = 0; i < 2; i++) {
    const rows = await sql`
      select distinct on (room_type) room_type, id
        from public.curated_images
       where is_active
       order by room_type, quality_score desc nulls last, display_order asc, id asc`;
    stable.push(rows.map((r) => `${r.room_type}:${r.id}`).join(","));
  }
  console.log(`same first row twice in a row = ${stable[0] === stable[1]}`);
})()
  .catch((e) => {
    console.error("read-back failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
