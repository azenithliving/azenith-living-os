import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

/**
 * Who reads each table, and with which credential — the contract of the database gate.
 *
 * The census found 69 tables answering to a stranger holding the public browser key. Sealing them is
 * only safe once the store knows which doors are doing their table work through that same public key:
 * those need their credential moved first, and the rest can be locked today with nothing dying.
 *
 * Every source file is classified by the client factory it imports:
 *   SERVICE — `lib/supabase-admin` (`getSupabaseAdminClient`) or the unified DAL's server client.
 *             The server's own credential, which stands outside row level security.
 *   PUBLIC  — `lib/supabase-server`'s public client, `utils/supabase/server|client`,
 *             `lib/supabase-client`, `lib/supabase` — all built from the key the browser already has.
 *
 * Nothing is changed by this script. It only answers, per table, who would be hurt by the lock.
 *
 *   node scratch/which-doors-read-with-the-public-key.mjs
 */

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const ROOTS = ["app", "lib", "components", "utils", "hooks", "scripts"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "scratch"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

const files = ROOTS.filter((r) => {
  try {
    statSync(r);
    return true;
  } catch {
    return false;
  }
}).flatMap((r) => walk(r));

const SERVICE_MARKS = ["@/lib/supabase-admin", "supabase-admin", "supabaseService"];
const PUBLIC_MARKS = [
  "@/lib/supabase-server",
  "@/utils/supabase",
  "@/lib/supabase-client",
  "@/lib/supabase\"",
  "@/lib/supabase'",
  "supabaseAnon",
  "createSupabaseBrowserClient",
];

const classified = files.map((path) => {
  const text = readFileSync(path, "utf8");
  return {
    path,
    text,
    service: SERVICE_MARKS.some((m) => text.includes(m)),
    public: PUBLIC_MARKS.some((m) => text.includes(m)),
  };
});

const dbFiles = classified.filter((f) => f.service || f.public);
console.log(`sources · source files scanned=${files.length} · files that open the record=${dbFiles.length}`);
console.log(`sources · of those, files holding the public credential=${dbFiles.filter((f) => f.public).length}`);

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
const tables = await sql`
  select c.relname as name, c.relrowsecurity as rls,
         (select count(*)::int from pg_policies p where p.tablename = c.relname) as policies
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' order by c.relname`;

const supaUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const PERSON = /(phone|mobile|email|customer|client|token|message|question|answer|user_id|address)/i;
const MOBILE = /1[0125]\d{8}/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const sealNow = [];
const needsCode = [];
const answeredEmpty = [];

for (const t of tables) {
  const res = await fetch(`${supaUrl}/rest/v1/${t.name}?select=*&limit=2`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res) {
    answeredEmpty.push({ name: t.name, note: "no answer" });
    continue;
  }
  const body = await res.text();
  let rows = -1;
  let personal = false;
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      rows = parsed.length;
      personal = MOBILE.test(body) || EMAIL.test(body) || Object.keys(parsed[0] ?? {}).some((c) => PERSON.test(c));
    }
  } catch {
    /* not a list */
  }
  if (rows !== 2) {
    answeredEmpty.push({ name: t.name, status: res.status });
    continue;
  }

  const readers = dbFiles.filter((f) => new RegExp(`["'\`]${t.name}["'\`]`).test(f.text));
  const publicReaders = readers.filter((f) => f.public).map((f) => f.path);
  const serviceReaders = readers.filter((f) => f.service && !f.public).map((f) => f.path);
  const entry = { name: t.name, rls: t.rls, policies: t.policies, personal, readers: readers.length, publicReaders, serviceReaders };
  if (publicReaders.length > 0) needsCode.push(entry);
  else sealNow.push(entry);
}

console.log(`\n== a stranger can read ${sealNow.length + needsCode.length} tables of ${tables.length} ==`);
console.log(`-- ${sealNow.length} of them are read only by the server's own credential (or by nobody): lock today, nothing dies --`);
for (const s of sealNow) {
  console.log(`SEAL · ${s.name} · rls=${s.rls} policies=${s.policies} personal=${s.personal} service-readers=${s.serviceReaders.length} named-in=${s.readers}`);
}
console.log(`-- ${needsCode.length} of them have a door doing table work on the PUBLIC key --`);
for (const n of needsCode) {
  console.log(`NEEDS-CODE · ${n.name} · personal=${n.personal} rls=${n.rls} · doors=[${n.publicReaders.join(", ")}]`);
}

const personalStillOpen = [...sealNow, ...needsCode].filter((t) => t.personal);
console.log(`\n== tables holding something about a person that answer to a stranger: ${personalStillOpen.length} ==`);
console.log(`   of those, lockable today: ${sealNow.filter((t) => t.personal).length} · needs a credential moved first: ${needsCode.filter((t) => t.personal).length}`);
console.log(`-- ${answeredEmpty.length} tables already refuse the public key or hold nothing --`);

await sql.end();
