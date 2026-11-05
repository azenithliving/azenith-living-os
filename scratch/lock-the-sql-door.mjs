import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * The emergency lock: the store's record stops answering to a stranger's SQL.
 *
 * Measured minutes ago with scratch/can-a-stranger-run-sql.mjs: `public.execute_sql(text)` is a
 * SECURITY DEFINER function owned by `postgres` (which stands outside row level security), and the
 * two public roles hold EXECUTE on it — so anyone holding the key the browser already ships could
 * hand the database any statement. This takes that privilege from the public roles only. The store's
 * own credential keeps it: `lib/sovereign-architect.ts` runs migrations through the admin client, and
 * that door is the reason the function exists at all.
 *
 * The way back is one sentence, printed by this script after the lock lands.
 *
 *   node scratch/lock-the-sql-door.mjs
 */

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });

const acl = async () =>
  sql`
    select r.rolname as grantee, a.privilege_type as priv
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(p.proacl) a
    join pg_roles r on r.oid = a.grantee
    where n.nspname = 'public' and p.proname = 'execute_sql' and p.proargnames[1] = 'sql_query'
    order by r.rolname`;

console.log("-- who may call it, before --");
for (const r of await acl()) console.log(`sources · ${r.grantee}: ${r.priv}`);

await sql`revoke execute on function public.execute_sql(text) from anon, authenticated`;

console.log("-- who may call it, after --");
for (const r of await acl()) console.log(`sources · ${r.grantee}: ${r.priv}`);

// Prove it from outside, the way a stranger would: the same statement that took two seconds before.
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const started = Date.now();
const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
  method: "POST",
  headers: { apikey: anon, Authorization: `Bearer ${anon}`, "content-type": "application/json" },
  body: JSON.stringify({ sql_query: "select pg_sleep(2)" }),
});
const text = await res.text();
console.log(`probe · stranger's call now answers status=${res.status} took=${Date.now() - started}ms · ${text.slice(0, 90).replace(/\s+/g, " ")}`);

// The store's own credential must still reach it, or the migration door would have died with it.
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const own = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
  method: "POST",
  headers: { apikey: service, Authorization: `Bearer ${service}`, "content-type": "application/json" },
  body: JSON.stringify({ sql_query: "select 1" }),
});
console.log(`probe · the store's own credential answers status=${own.status} (200 or 204 means the migration door is alive)`);
console.log(`\nway back · revoke was: revoke execute on function public.execute_sql(text) from anon, authenticated`);
console.log(`way back · to undo:   grant execute on function public.execute_sql(text) to anon, authenticated`);

await sql.end();
