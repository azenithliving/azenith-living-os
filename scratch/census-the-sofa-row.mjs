import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

/**
 * Everything the store holds about the one inherited product row, and everything that would go with
 * it. Read-only: this is the census taken before an erase the owner ordered by name.
 */
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1, connect_timeout_ms: 25000 });

const rows = await sql`select to_jsonb(p)::text as j from products p where name = 'صوفا ملكية'`;
console.log(`rows matching the name: ${rows.length}`);
for (const r of rows) console.log(`the row: ${r.j}`);

const kids = await sql`
  select conrelid::regclass::text as child, confdeltype, conname
  from pg_constraint where confrelid = 'products'::regclass and contype = 'f'`;
console.log(`children pointing at products: ${kids.length}`);
for (const k of kids) console.log(`  ${k.child} delete=${k.confdeltype}`);

if (rows[0]) {
  const id = JSON.parse(rows[0].j).id;
  for (const table of ["product_inventory_log", "sales_order_items"]) {
    try {
      const n = await sql.unsafe(`select count(*)::int as n from ${table}`);
      console.log(`${table} rows in total: ${n[0].n}`);
    } catch (e) {
      console.log(`${table}: ${e.message.slice(0, 80)}`);
    }
  }
  const inv = await sql`select count(*)::int as n from product_inventory_log where product_id = ${id}`;
  console.log(`inventory log rows for this product: ${inv[0].n}`);
}

const total = await sql`select count(*)::int as n from products`;
console.log(`products total: ${total[0].n}`);
await sql.end();
