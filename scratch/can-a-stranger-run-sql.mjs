import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * Can a stranger run SQL against the store's record with only the key the browser already holds?
 *
 * The function census found `execute_sql` marked SECURITY DEFINER with EXECUTE granted to the public
 * roles. This answers what that means, with one statement that changes nothing: ask the database who
 * it is being asked as. No row is written, no table is touched, and the number printed is the role
 * name, not a secret.
 *
 *   node scratch/can-a-stranger-run-sql.mjs
 */

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });

const shape = await sql`
  select p.proname, pg_get_function_arguments(p.oid) as args, p.prosecdef,
         r.rolname as owner, r.rolsuper, r.rolbypassrls
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_roles r on r.oid = p.proowner
  where n.nspname = 'public' and p.proname in ('execute_sql','get_or_create_client_access','get_product_stats','get_quality_metrics','cleanup_expired_tokens','mark_dead_image','match_knowledge')`;
for (const s of shape) {
  console.log(`sources · ${s.proname}(${String(s.args).slice(0, 60)}) definer=${s.prosecdef} runs-as=${s.owner} that-role-superuser=${s.rolsuper} bypasses-rls=${s.rolbypassrls}`);
}

const src = await sql`
  select pg_get_functiondef(p.oid) as body from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'execute_sql'`;
console.log("--- what the function actually does ---");
console.log(String(src[0]?.body ?? "absent").slice(0, 800));

const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/execute_sql`;

// The argument name is read from the signature above rather than guessed.
const probes = [
  // A statement that cannot write anything, whose only observable effect is the clock it takes.
  { sql_query: "select pg_sleep(2)" },
  // A statement that cannot parse: a 500 here proves the text was really executed, not just accepted.
  { sql_query: "select from into where" },
  // Control: the door with no statement at all.
  {},
];
for (const body of probes) {
  const started = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - started;
  const text = await res.text();
  const keys = Object.keys(body).join(",") || "none";
  console.log(`probe · arg=[${keys}] · status=${res.status} · took=${ms}ms · answer=${text.slice(0, 70).replace(/\s+/g, " ")}`);
  if (body.sql_query === "select pg_sleep(2)" && res.status === 200 && ms > 1800) {
    console.log("VERDICT · a stranger CAN run SQL through the public key — the hole is real.");
  }
}

await sql.end();
