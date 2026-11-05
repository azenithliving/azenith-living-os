import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * What the public roles can still reach after the lock — read-only, and answered over HTTP too.
 *
 * The census proved 0 tables answering a stranger. This checks the other half: the stored functions.
 * An entry surviving in the privilege catalogue is not the same thing as a stranger reaching it, so
 * both are measured — the catalogue, and the actual door.
 *
 *   node scratch/measure-what-the-public-still-calls.mjs
 */

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });

const rows = await sql`
  select p.proname,
         pg_get_function_identity_arguments(p.oid) as args,
         p.prosecdef,
         string_agg(distinct r.rolname, ',' order by r.rolname) as grantees,
         string_agg(distinct g.rolname, ',' order by g.rolname) as grantors
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(p.proacl) a
  join pg_roles r on r.oid = a.grantee
  join pg_roles g on g.oid = a.grantor
  where n.nspname = 'public' and r.rolname in ('anon','authenticated') and a.privilege_type = 'EXECUTE'
  group by p.oid, p.proname, args, p.prosecdef
  order by p.prosecdef desc, p.proname`;

console.log(`sources · catalogue entries still naming the public roles: ${rows.length} functions`);
console.log(`sources · of those, SECURITY DEFINER (they run as their owner, outside the gate): ${rows.filter((r) => r.prosecdef).length}`);
for (const r of rows.filter((x) => x.prosecdef).slice(0, 20)) {
  console.log(`DEFINER · ${r.proname}(${String(r.args).slice(0, 40)}) · granted-to=${r.grantees} · by=${r.grantors}`);
}

const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sensitive = rows
  .filter((r) => /client_access|dead_image|knowledge|quality|product_stats|cleanup_expired|company|token|secret|sql/i.test(r.proname))
  .slice(0, 10);

console.log(`\n== the same functions, asked over HTTP the way a stranger would (${sensitive.length}) ==`);
for (const r of sensitive) {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${r.proname}`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const text = await res.text();
  const refused = res.status === 401 || res.status === 403 || res.status === 404;
  console.log(`${refused ? "REFUSED" : "ANSWERED"} · ${r.proname} · status=${res.status} · ${text.slice(0, 70).replace(/\s+/g, " ")}`);
}

await sql.end();
