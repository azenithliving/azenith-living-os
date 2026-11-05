import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * Creates the customer memory table and reads it back out of the catalogue — the columns, the kind
 * constraint, and whether the gate is on. Nothing is trusted from the file's own intention.
 *
 *   node scratch/apply-customer-memory-migration.mjs
 */

const FILE = "supabase/migrations/20261015_b_customer_memory.sql";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });

const before = (await sql`select to_regclass('public.customer_memory') as r`)[0].r;
console.log(`before · public.customer_memory = ${before ?? "مش موجود"}`);

const statements = readFileSync(FILE, "utf8")
  .split("--SPLIT--")
  .map((chunk) => chunk.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

for (const [i, statement] of statements.entries()) {
  await sql.unsafe(statement);
  console.log(`statement ${i + 1}/${statements.length} ran`);
}

const cols = await sql`
  select column_name, data_type, is_nullable from information_schema.columns
  where table_schema = 'public' and table_name = 'customer_memory' order by ordinal_position`;
console.log(`after · columns (${cols.length}): ${cols.map((c) => c.column_name).join(", ")}`);

const wanted = ["company_id", "customer_key", "kind", "value", "source", "evidence", "first_seen_at", "last_seen_at"];
const missing = wanted.filter((name) => !cols.some((c) => c.column_name === name));
console.log(`after · columns the writer names and the table lacks: ${missing.length ? missing.join(", ") : "none"}`);

const state = await sql`
  select c.relrowsecurity as rls,
         (select count(*)::int from pg_policies p where p.tablename = 'customer_memory') as policies,
         (select count(*)::int from pg_indexes i where i.tablename = 'customer_memory') as indexes
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'customer_memory'`;
console.log(`after · row-security=${state[0].rls} policies=${state[0].policies} indexes=${state[0].indexes}`);

// The API keeps its own list of the tables it serves; a table created a second ago is not in it yet.
await sql`select pg_notify('pgrst', 'reload schema')`;
await new Promise((resolveWait) => setTimeout(resolveWait, 4000));

const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const probe = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/customer_memory?select=*&limit=1`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
});
console.log(`probe · a stranger reading it · status=${probe.status} (401 is the gate holding)`);

const service = env.SUPABASE_SERVICE_ROLE_KEY;
const own = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/customer_memory?select=*&limit=1`, {
  headers: { apikey: service, Authorization: `Bearer ${service}` },
});
console.log(`probe · the store's own credential reading it · status=${own.status}`);

const ok = missing.length === 0 && state[0].rls === true && state[0].policies === 0 && probe.status === 401 && own.status === 200;
console.log(`\nverdict · ${ok ? "الذاكرة اتعملت ومقفولة على مفتاح المتجر" : "القفل ناقص — السطور فوق بتقول إيه"}`);
await sql.end();
process.exit(ok ? 0 : 1);
