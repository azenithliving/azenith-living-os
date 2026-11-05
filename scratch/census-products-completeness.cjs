const postgres = require("postgres");

async function main() {
  const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
  const rows = await sql`
    select
      count(*)::int as total,
      count(*) filter (where is_active)::int as active,
      count(*) filter (where visibility = 'public')::int as public_vis,
      count(*) filter (where featured_image_url is not null and featured_image_url <> '')::int as has_cover,
      count(*) filter (where gallery_images is not null and jsonb_typeof(gallery_images) = 'array'
                        and jsonb_array_length(gallery_images) > 0)::int as has_gallery,
      count(*) filter (where description is not null and length(trim(description)) >= 40)::int as desc_40plus,
      count(*) filter (where short_description is not null and length(trim(short_description)) > 0)::int as has_short,
      count(*) filter (where meta_title is not null and length(trim(meta_title)) > 0)::int as has_meta_title,
      count(*) filter (where meta_description is not null and length(trim(meta_description)) > 0)::int as has_meta_desc,
      count(*) filter (where specifications is not null and jsonb_typeof(specifications) = 'array'
                        and jsonb_array_length(specifications) > 0)::int as has_specs_array,
      count(*) filter (where specifications is not null and jsonb_typeof(specifications) = 'object'
                        and specifications::text <> '{}')::int as specs_obj_probe,
      count(*) filter (where sale_price is not null and sale_price > 0)::int as has_price,
      count(*) filter (where sku is not null and length(trim(sku)) > 0)::int as has_sku,
      count(*) filter (where name ~ '[A-Za-z]')::int as name_has_latin,
      count(*) filter (where description ~ '[A-Za-z]')::int as desc_has_latin
    from products`;
  const r = rows[0];
  for (const [k, v] of Object.entries(r)) console.log(k + " = " + v);

  const grouped = await sql`
    select coalesce(pc.name,'(بلا قسم)') as cat, count(*)::int as n,
           count(*) filter (where p.featured_image_url is not null and p.featured_image_url <> '')::int as covers
    from products p left join product_categories pc on pc.id = p.category_id
    group by 1 order by n desc`;
  console.log("\nby category (n / with cover):");
  for (const g of grouped) console.log(`  ${g.cat} = ${g.n} / ${g.covers}`);

  const sample = await sql`
    select name, slug, is_active, visibility,
           (featured_image_url is not null and featured_image_url <> '') as cover,
           coalesce(jsonb_array_length(nullif(case when jsonb_typeof(gallery_images)='array' then gallery_images end,'null'::jsonb)),0) as gal,
           coalesce(length(description),0) as dlen
    from products order by created_at limit 12`;
  console.log("\nsample:");
  for (const s of sample) console.log("  " + JSON.stringify(s));

  await sql.end();
}
main().catch((e) => {
  console.log("ERROR", e.message);
  process.exit(1);
});
