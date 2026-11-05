import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

/**
 * Where the store's own phone number is produced today. The number is public (a customer reads it),
 * so the census prints digits and endings, not the whole value: the point is counting owners.
 */
const digits = (v) => (v ?? "").replace(/\D/g, "");

const names = ["WHATSAPP_DEFAULT_NUMBER", "NEXT_PUBLIC_WHATSAPP_NUMBER"];
console.log("environment variables:");
for (const n of names) {
  const v = process.env[n];
  console.log(`  ${n} = ${v ? `set, ${digits(v).length} digits, ending ${digits(v).slice(-4)}` : "NOT SET"}`);
}

const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1, connect_timeout_ms: 25000 });

const tables = await sql`select table_name from information_schema.tables where table_schema='public' and (table_name like '%tenant%' or table_name='companies')`;
console.log(`\ntables that could hold the number: ${tables.map((t) => t.table_name).join(", ") || "none"}`);

const cols = await sql`
  select table_name, column_name from information_schema.columns
  where table_schema='public' and column_name ilike '%whatsapp%'`;
console.log(`columns carrying a whatsapp value: ${cols.length}`);
for (const c of cols) console.log(`  ${c.table_name}.${c.column_name}`);

for (const c of cols) {
  const rows = await sql.unsafe(`select ${c.column_name} as v, count(*)::int as n from ${c.table_name} group by 1 limit 5`);
  console.log(`  ${c.table_name}.${c.column_name} distinct values: ${rows.length}`);
  for (const r of rows) console.log(`    ${r.v ? `${digits(String(r.v)).length} digits ending ${digits(String(r.v)).slice(-4)}` : "null"} × ${r.n} rows`);
}

const hardcoded = "201090819584";
const envA = digits(process.env.WHATSAPP_DEFAULT_NUMBER);
const envB = digits(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
const values = { "the code's fallback in lib/tenant.ts": digits(hardcoded), WHATSAPP_DEFAULT_NUMBER: envA, NEXT_PUBLIC_WHATSAPP_NUMBER: envB };
console.log("\nthe three producers today:");
for (const [k, v] of Object.entries(values)) console.log(`  ${k}: ${v ? `${v.length} digits ending ${v.slice(-4)}` : "empty"}`);
console.log(`distinct numbers in play: ${new Set(Object.values(values).filter(Boolean)).size}`);

const settings = await sql`select key, value::text v from site_settings where key ilike '%hour%' or key ilike '%whatsapp%' or key ilike '%contact%'`;
console.log(`\nsite_settings keys about hours, contact or whatsapp: ${settings.length}`);
for (const s of settings) console.log(`  ${s.key} = ${s.v.slice(0, 120)}`);
await sql.end();
