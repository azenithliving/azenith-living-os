import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });

const grants = await sql`
  select p.proname, p.prosecdef, r.rolname as grantee
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(p.proacl) a
  join pg_roles r on r.oid = a.grantee
  where n.nspname = 'public' and r.rolname in ('anon','authenticated') and a.privilege_type = 'EXECUTE'
  order by p.proname`;
const unique = [...new Set(grants.map((g) => `${g.proname} definer=${g.prosecdef}`))];
console.log(`functions with an explicit EXECUTE grant to the public roles: ${unique.length}`);
console.log(unique.join("\n") || "none");

const noAcl = await sql`
  select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proacl is null`;
console.log(`functions with NO acl (owner only, so nobody else executes): ${noAcl[0].n}`);

const def = await sql`
  select pg_get_functiondef(p.oid) as src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'execute_sql'`;
console.log("--- execute_sql definition (first 900 chars) ---");
console.log(String(def[0]?.src ?? "absent").slice(0, 900));

const anonCallable = await sql`
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and pg_has_role('anon'::regrole, p.pronamespace, 'usage')
    and has_function_privilege('anon', p.oid, 'execute') order by p.proname`;
console.log(`has_function_privilege says anon may execute: ${anonCallable.map((r) => r.proname).join(", ") || "none"}`);

await sql.end();
