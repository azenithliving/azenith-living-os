const postgres = require("postgres");

async function main() {
  const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema='public' and (table_name like '%product%' or table_name like '%catalog%' or table_name like '%item%')
    order by table_name`;
  console.log("tables:", tables.map((t) => t.table_name).join(", "));
  for (const t of tables) {
    const cols = await sql`
      select column_name, data_type from information_schema.columns
      where table_schema='public' and table_name=${t.table_name} order by ordinal_position`;
    console.log("\n## " + t.table_name);
    console.log("  cols:", cols.map((c) => c.column_name + ":" + c.data_type).join(", "));
  }
  await sql.end();
}
main().catch((e) => {
  console.log("ERROR", e.message);
  process.exit(1);
});
