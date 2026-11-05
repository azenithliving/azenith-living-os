import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

const wanted = [
  "sales_orders",
  "sales_order_items",
  "leads",
  "room_sketches",
  "room_sections",
  "ops_drafts",
  "production_jobs",
  "sheet_visits",
  "products",
  "product_categories",
  "bookings",
  "payments",
  "inventory_items",
  "customer_memory",
];

const sql = postgres(env.DIRECT_URL, { max: 1 });

for (const table of wanted) {
  const pk = await sql`
    select kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
      and kcu.table_schema = tc.table_schema and kcu.table_name = tc.table_name
    where tc.table_schema = 'public' and tc.table_name = ${table} and tc.constraint_type = 'PRIMARY KEY'
    order by kcu.ordinal_position`;
  const cols = await sql`select column_name from information_schema.columns where table_schema='public' and table_name=${table}`;
  const n = cols.length ? await sql.unsafe(`select count(*)::int as n from public."${table}"`) : [{ n: -1 }];
  console.log(
    `${table}: pk=[${pk.map((r) => r.column_name).join(",")}] columns=${cols.length} rows=${n[0].n}`,
  );
}

await sql.end();
