const postgres = require("postgres");
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
(async () => {
  const r = await sql`select id, room_type, style, quality_score::text q, left(url, 58) u, source, display_order from public.curated_images order by id asc limit 3`;
  for (const x of r) console.log(`${x.id} | ${x.room_type}/${x.style} | ${x.q} | ${x.source} | ${x.display_order} | ${x.u}`);
  const mx = await sql`select max(id)::text hi, min(id)::text lo, count(*)::int n from public.curated_images`;
  console.log("أصغر/أكبر معرّف: " + mx[0].lo + " / " + mx[0].hi + " | صفوف: " + mx[0].n);
  const dup = await sql`select count(*)::int n from public.curated_images where url like $$%images.pexels.com%$$`;
  console.log("روابط من بيكسلز: " + dup[0].n);
  await sql.end();
})().catch(e => { console.error(e.message); process.exit(1); });
