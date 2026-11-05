import fs from "node:fs";
import dotenv from "dotenv";
import postgres from "postgres";

for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) dotenv.config({ path: f });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

const kinds = await sql`select table_type, count(*)::int c from information_schema.tables where table_schema='public' group by table_type`;
console.log("kinds:", JSON.stringify(kinds));

const views = await sql`select table_name from information_schema.views where table_schema='public'`;
console.log("views:", views.length, "· first:", views.slice(0, 6).map((r) => r.table_name).join(","));

const underscore = await sql`select count(*)::int c from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and left(table_name,1)='_'`;
console.log("underscore-prefixed base tables:", JSON.stringify(underscore));

for (const n of ["enterprise_agents", "v_products_with_category", "p6_store_company"]) {
  const rows = await sql`select table_schema, table_type from information_schema.tables where table_name=${n}`;
  console.log(n + ":", JSON.stringify(rows));
}

// What the PostgREST root document exposes, for the same comparison.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const spec = await (await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Accept: "application/json" } })).json();
const defs = Object.keys(spec.definitions || {});
console.log("root document relations:", defs.length);
const base = (await sql`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`).map((r) => r.table_name);
const viewNames = views.map((r) => r.table_name);
console.log("in the document, not a base table and not a view:", defs.filter((d) => !base.includes(d) && !viewNames.includes(d)).join(","));
console.log("base tables the document does not expose:", base.filter((b) => !defs.includes(b)).join(","));
await sql.end();
