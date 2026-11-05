const postgres = require("postgres");
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
(async () => {
  const bank = await sql`select room_type, count(*)::int n, count(*) filter (where quality_score is not null)::int scored from public.curated_images group by 1 order by n desc`;
  console.log("=== البنك ===");
  for (const r of bank) console.log(`${r.n}\t${r.scored}\t${r.room_type}`);
  const cols = await sql`select column_name from information_schema.columns where table_schema=$$public$$ and table_name=$$products$$ order by 1`;
  console.log("\nأعمدة المنتجات: " + cols.map(c=>c.column_name).join(", "));
  await sql.end();
})().catch(e => { console.error(e.message); process.exit(1); });
