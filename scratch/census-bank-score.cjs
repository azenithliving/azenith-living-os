const postgres = require("postgres");
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
(async () => {
  const q = await sql`select count(*)::int n, count(*) filter (where quality_score > 0)::int above_zero, min(quality_score)::text lo, max(quality_score)::text hi, count(distinct room_type)::int rooms from public.curated_images where is_active = true`;
  console.log("البنك النشط: " + JSON.stringify(q[0]));
  await sql.end();
})().catch(e => { console.error(e.message); process.exit(1); });
