import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

/** What the settings desk actually holds: every key, its shape, and when it last moved. */
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1, connect_timeout_ms: 25000 });

const rows = await sql`
  select key,
         jsonb_typeof(value) as kind,
         case when jsonb_typeof(value) = 'object'
              then (select string_agg(k, ', ' order by k) from jsonb_object_keys(value) k)
              else left(value::text, 90) end as shape,
         coalesce(length(value::text), 0) as chars,
         updated_at
  from site_settings order by key`;

console.log(`site_settings rows: ${rows.length}`);
for (const r of rows) {
  console.log(`\n## ${r.key} · ${r.kind} · ${r.chars} chars · updated ${r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 16) : "n/a"}`);
  console.log(`   ${r.shape ?? ""}`);
}
await sql.end();
