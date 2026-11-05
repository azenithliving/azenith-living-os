const postgres = require("postgres");
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
(async () => {
  const q = await sql`select c.id, c.name, c.slug, count(p.id)::int as products, count(p.id) filter (where p.featured_image_url is not null and p.featured_image_url <> $$\$$)::int as with_image from public.categories c left join public.products p on p.category_id = c.id group by 1,2,3 order by products desc`;
  console.log("أقسام | منتجات | بصور");
  for (const r of q) console.log(`${r.products}\t${r.with_image}\t${r.slug} — ${r.name}`);
  const orphan = await sql`select count(*)::int n from public.products where category_id is null`;
  console.log("بلا قسم: " + orphan[0].n);
  await sql.end();
})().catch(e => { console.error(e.message); process.exit(1); });
