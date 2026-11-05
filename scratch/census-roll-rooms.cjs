const postgres = require("postgres");
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
(async () => {
  const cols = await sql`select table_name from information_schema.columns where column_name in ($$room_type$$) and table_schema = $$public$$`;
  for (const c of cols) {
    const rows = await sql.unsafe(`select room_type as v, count(*)::int as n from public.${c.table_name} group by 1 order by n desc limit 15`);
    if (!rows.length) continue;
    console.log(`\n### ${c.table_name}`);
    for (const r of rows) console.log(`${r.n}\t${JSON.stringify(r.v)}`);
  }
  await sql.end();
})().catch(e => { console.error(e.message); process.exit(1); });
