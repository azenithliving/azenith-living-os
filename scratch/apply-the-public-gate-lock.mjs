import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * Applies the store's own lock — `supabase/migrations/20261015_a_lock_the_public_gate.sql` — and reads
 * the result back out of the catalogue rather than out of its own intention.
 *
 * Run only AFTER the build that carries the server's own credential is live: the lock takes the record
 * away from the public browser key, and a deployed door still reading with that key would go quiet.
 *
 *   node scratch/apply-the-public-gate-lock.mjs
 */

const FILE = "supabase/migrations/20261015_a_lock_the_public_gate.sql";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });

const census = async () => ({
  tablePrivs: (
    await sql`
      select count(*)::int as n from information_schema.table_privileges
      where table_schema = 'public' and grantee in ('anon','authenticated')`
  )[0].n,
  fnPrivs: (
    await sql`
      select count(*)::int as n from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(p.proacl) a
      join pg_roles r on r.oid = a.grantee
      where n.nspname = 'public' and r.rolname in ('anon','authenticated') and a.privilege_type = 'EXECUTE'`
  )[0].n,
  noRls: (
    await sql`
      select count(*)::int as n from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false`
  )[0].n,
  serviceStill: (
    await sql`
      select count(*)::int as n from information_schema.table_privileges
      where table_schema = 'public' and grantee = 'service_role'`
  )[0].n,
});

const before = await census();
console.log(
  `before · privileges held by the public roles=${before.tablePrivs} · functions they may call=${before.fnPrivs} · tables with no row security=${before.noRls} · the server's own grants=${before.serviceStill}`,
);

const statements = readFileSync(FILE, "utf8")
  .split("--SPLIT--")
  .map((chunk) => chunk.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

for (const [i, statement] of statements.entries()) {
  await sql.unsafe(statement);
  console.log(`statement ${i + 1}/${statements.length} ran`);
}

const after = await census();
console.log(
  `after · privileges held by the public roles=${after.tablePrivs} · functions they may call=${after.fnPrivs} · tables with no row security=${after.noRls} · the server's own grants=${after.serviceStill}`,
);

// Prove it the way a stranger would: the public key against the worst table and the worst function.
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const probe = async (label, run) => {
  const res = await run();
  console.log(`probe · ${label} · status=${res.status}`);
};
await probe("a stranger selecting from users", () =>
  fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?select=*&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  }),
);
await probe("a stranger calling execute_sql", () =>
  fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "content-type": "application/json" },
    body: JSON.stringify({ sql_query: "select 1" }),
  }),
);
const storeOwn = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/room_sketches?select=id&limit=1`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
});
console.log(`probe · the store's own credential still reads the record · status=${storeOwn.status}`);

const lockTheWayBack = after.tablePrivs === 0 && after.fnPrivs === 0 && after.noRls === 0;
console.log(`\nverdict · ${lockTheWayBack ? "the public roles hold nothing left in the store's record" : "the lock is not complete — the numbers above say what is left"}`);
console.log("way back · the statements are written at the head of the migration file, in one block.");

await sql.end();
process.exit(lockTheWayBack ? 0 : 1);
