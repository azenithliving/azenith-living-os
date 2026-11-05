import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * The database gate, censused table by table — read-only, before anything is tightened.
 *
 * Why this exists: measuring customer isolation on the published site found that a browser holding
 * only the key the site already ships can read rows out of tables the store believes are private.
 * Before touching a single policy, the machine needs the whole list: which tables have the gate
 * switched on, which roles the gate admits, what a stranger actually gets back, and whether a
 * customer's own words or number are inside what came back. No value is ever printed — only names,
 * counts, and yes/no about shape.
 *
 *   node scratch/census-the-database-gate.mjs
 */

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
const supaUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const roles = await sql`
  select rolname, rolcanlogin, rolbypassrls from pg_roles
  where rolname in ('anon','authenticated','service_role','postgres') order by rolname`;
console.log("== the roles and whether they stand outside the gate ==");
for (const r of roles) console.log(`sources · ${r.rolname}: login=${r.rolcanlogin} bypasses-row-security=${r.rolbypassrls}`);

const fnGrants = await sql`
  select count(*)::int as n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(p.proacl) a
  join pg_roles r on r.oid = a.grantee
  where n.nspname = 'public' and r.rolname in ('anon','authenticated') and a.privilege_type = 'EXECUTE'`;
console.log(`sources · stored functions the two public roles hold an explicit EXECUTE on: ${fnGrants[0].n}`);

const tables = await sql`
  select c.oid::regclass::text as fqn, c.relname, c.relrowsecurity, c.relforcerowsecurity,
         (select count(*)::int from pg_policies p where p.tablename = c.relname) as policies,
         coalesce(s.n_live_tup, 0)::int as live_rows
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relname = c.relname and s.schemaname = 'public'
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname`;
console.log(`\n== ${tables.length} tables in the store's record ==`);

/** Words that mark a column as holding something about a person, not about a picture. */
const PERSON_COLUMN = /(phone|mobile|email|customer|client|passenger|name|address|city|token|message|content|question|answer|draft|lead|booking|whatsapp|user_id|owner)/i;
/** The shape of an Egyptian mobile, or an email address — used to answer yes/no, never printed. */
const MOBILE = /1[0125]\d{8}/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const leaked = [];
const gated = [];
const emptyButOpen = [];

for (const t of tables) {
  let status = 0;
  let rows = -1;
  let shape = { mobile: false, email: false, cols: [] };
  try {
    const res = await fetch(`${supaUrl}/rest/v1/${t.relname}?select=*&limit=2`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      signal: AbortSignal.timeout(15000),
    });
    status = res.status;
    const text = await res.text();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      rows = parsed.length;
      if (rows > 0) {
        shape.cols = Object.keys(parsed[0] ?? {});
        shape.mobile = MOBILE.test(text);
        shape.email = EMAIL.test(text);
      }
    }
  } catch (e) {
    status = -1;
  }

  const personal = shape.cols.filter((c) => PERSON_COLUMN.test(c));
  if (rows > 0 && (shape.mobile || shape.email || personal.length > 0)) {
    leaked.push({ name: t.relname, rows, rls: t.relrowsecurity, policies: t.policies, personal, mobile: shape.mobile, email: shape.email, live: t.live_rows });
  } else if (rows > 0) {
    emptyButOpen.push({ name: t.relname, rows, rls: t.relrowsecurity, policies: t.policies, live: t.live_rows });
  } else {
    gated.push({ name: t.relname, status, rls: t.relrowsecurity, policies: t.policies, live: t.live_rows });
  }
}

console.log(`\n== answers to a stranger holding only the public key: ${leaked.length + emptyButOpen.length} tables ==`);
console.log(`-- ${leaked.length} of them carry something about a PERSON --`);
for (const l of leaked) {
  console.log(`LEAK · ${l.name} · returned=${l.rows} live_rows=${l.live} rls=${l.rls} policies=${l.policies} personal-columns=[${l.personal.join(",")}] mobile-shape=${l.mobile} email-shape=${l.email}`);
}
console.log(`-- ${emptyButOpen.length} answer rows that carry no person-shaped column --`);
for (const o of emptyButOpen) console.log(`OPEN · ${o.name} · returned=${o.rows} live_rows=${o.live} rls=${o.rls} policies=${o.policies}`);
console.log(`-- ${gated.length} refused or answered empty --`);

const noRls = tables.filter((t) => !t.relrowsecurity);
console.log(`\n== the gate switched OFF: ${noRls.length} tables ==`);
console.log(noRls.map((t) => t.relname).join(", ").slice(0, 2000));

const policies = await sql`
  select tablename, policyname, permissive, cmd, roles::text as roles, qual
  from pg_policies where schemaname = 'public' order by tablename, policyname`;
console.log(`\n== every policy that exists (${policies.length}) ==`);
for (const p of policies) console.log(`sources · ${p.tablename} · ${p.policyname} · ${p.permissive} for ${p.cmd} · roles=${p.roles} · using=${String(p.qual ?? "").slice(0, 120)}`);

const grants = await sql`
  select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privs
  from information_schema.table_privileges
  where table_schema = 'public' and grantee in ('anon','authenticated')
  group by table_name, grantee order by table_name, grantee`;
console.log(`\n== grants to the two public roles (${grants.length} rows) ==`);
const byTable = {};
for (const g of grants) (byTable[g.table_name] ??= []).push(`${g.grantee}:${g.privs}`);
console.log(`tables granting to anon/authenticated: ${Object.keys(byTable).length}`);
console.log(Object.entries(byTable).slice(0, 40).map(([k, v]) => `${k} → ${v.join(" / ")}`).join("\n").slice(0, 2500));

await sql.end();
