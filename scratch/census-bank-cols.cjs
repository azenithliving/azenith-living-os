const postgres = require("postgres");
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
(async () => {
  const c = await sql`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema=$$public$$ and table_name=$$curated_images$$ order by 1`;
  for (const r of c) console.log(`${r.column_name}\t${r.data_type}\t${r.is_nullable}\t${r.column_default ?? ""}`);
  await sql.end();
})().catch(e => { console.error(e.message); process.exit(1); });
