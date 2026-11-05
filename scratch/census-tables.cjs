const postgres = require("postgres");
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
(async () => {
  const t = await sql`select table_name from information_schema.tables where table_schema=$$public$$ and (table_name like $$%categ%$$ or table_name like $$%room%$$ or table_name like $$%product%$$) order by 1`;
  console.log(t.map(r=>r.table_name).join("\n"));
  const p = await sql`select count(*)::int n, count(*) filter (where featured_image_url is not null)::int with_image, count(distinct category_id)::int cats from public.products`;
  console.log("منتجات: " + JSON.stringify(p[0]));
  await sql.end();
})().catch(e => { console.error(e.message); process.exit(1); });
