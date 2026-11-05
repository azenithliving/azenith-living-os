import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * بند ٣٣ — مفتش الأذونات: does one customer really see only his own sheet and his own data?
 *
 * The design says the long random address IS the login, so the claim being measured is not "a
 * stranger is signed out" — it is four harder things, each measured between TWO real sheets on the
 * published site, minted by the store's own customer door and erased by id at the end:
 *
 *   ١) one address opens exactly one sheet: A's answer carries none of B's numbers, area, token,
 *      row id or vote labels — and the other way round;
 *   ٢) nobody walks from A to B: the row number in the address is refused, no door lists sheets,
 *      and every owner-side door refuses a browser holding no passport;
 *   ٣) a paper already claimed is not stealable: a stranger typing the other customer's number on
 *      B's address must leave B's owner key unchanged — read from the table, not from the reply;
 *   ٤) the isolation is not only the app's good manners: the database gate answers to a browser
 *      holding just the public key it already ships, and no service credential rides in what the
 *      browser downloads.
 *
 *   node scratch/isolate-two-customers.mjs
 */

const BASE = "https://azenith-living.vercel.app";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });

/** A one-pixel PNG: the paper is a prop here, the measurement is the address. */
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** Numbers chosen so they belong to nobody: 010 000 0001 / 011 000 0002. */
const PHONE_A = "01000000001";
const PHONE_B = "01100000002";
const KEY_A = "phone:1000000001";
const KEY_B = "phone:1100000002";
/** His own digits, distinctive enough to be found in a payload if a payload ever leaks them. */
const DIMS_A = [4.17, 3.29];
const DIMS_B = [8.23, 6.11];
const VOTER_A = "زائر الألف للعزل";
const VOTER_B = "زائر الباء للعزل";
const IMG_A = "isoltest-A";
const IMG_B = "isoltest-B";

let checks = 0;
let fails = 0;

function claim(label, ok, detail) {
  checks += 1;
  if (!ok) fails += 1;
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}${detail ? ` · ${detail}` : ""}`);
}

async function api(path, init = {}) {
  const res = await fetch(BASE + path, { redirect: "manual", ...init });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* HTML or empty */
  }
  return { status: res.status, text, body, loc: res.headers.get("location") };
}

const post = (path, obj, headers = {}) =>
  api(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(obj),
  });

function hasAll(haystack, needles) {
  return needles.filter((n) => haystack.includes(String(n)));
}

// ---------------------------------------------------------------- the two sheets

// Anything the instrument left behind in an earlier, unfinished run goes before the measurement
// starts — the two numbers below are the instrument's own fingerprint, nobody else's.
const leftovers = await sql`delete from room_sketches where customer_key in (${KEY_A}, ${KEY_B}) returning id`;
if (leftovers.length) console.log(`sources · cleared ${leftovers.length} row left by an earlier run: ${leftovers.map((r) => r.id).join(", ")}`);

const countsBefore = await sql`
  select
    (select count(*)::int from room_sketches) as sketches,
    (select count(*)::int from family_votes) as votes,
    (select count(*)::int from sheet_visits) as visits`;
console.log(`store before · sketches=${countsBefore[0].sketches} votes=${countsBefore[0].votes} visits=${countsBefore[0].visits}`);

const minted = [];
for (const phone of [PHONE_A, PHONE_B]) {
  const res = await post("/api/sheet", { image: PNG, phone });
  const path = res.body?.passport_path ?? "";
  const token = path.split("/").pop() ?? "";
  if (res.status !== 200 || !token) {
    console.log(`REFUSING: the store's own door did not mint a sheet for ${phone} (status=${res.status})`);
    process.exit(1);
  }
  minted.push({ phone, token });
}
const [A, B] = minted;

const rows = await sql`select id, token, customer_key, customer_city, image_path from room_sketches where token in (${A.token}, ${B.token}) order by id`;
const rowA = rows.find((r) => r.token === A.token);
const rowB = rows.find((r) => r.token === B.token);
console.log(`minted · A id=${rowA?.id} token=${A.token.slice(0, 4)}… · B id=${rowB?.id} token=${B.token.slice(0, 4)}… (sources: full tokens, prefixes only printed)`);
if (!rowA || !rowB) {
  console.log("REFUSING: the two rows are not both in the table.");
  process.exit(1);
}
const ID_A = rowA.id;
const ID_B = rowB.id;
const PATH_A = rowA.image_path;
const PATH_B = rowB.image_path;

// Each writes his OWN numbers through his OWN address, so every payload has something to find.
const sealA = await post(`/api/passport/${A.token}`, { dimensions: DIMS_A, customer_phone: PHONE_A });
const sealB = await post(`/api/passport/${B.token}`, { dimensions: DIMS_B, customer_phone: PHONE_B });
console.log(`sources · sheet A numbers written status=${sealA.status} · sheet B status=${sealB.status}`);

const cityB = await post(`/api/passport/${B.token}/contact`, { phone: PHONE_B, city: "مدينتي", room: "غرف المعيشة" });
console.log(`sources · sheet B area written status=${cityB.status}`);

// ---------------------------------------------------------------- ١ one address, one sheet

console.log("\n== ١) كل عنوان يفتح ورقته هو وبس ==");
const getA = await api(`/api/passport/${A.token}`, { headers: { "x-visit-key": "isol-device-aaaa" } });
const getB = await api(`/api/passport/${B.token}`, { headers: { "x-visit-key": "isol-device-bbbb" } });
claim("A's own address answers his sheet", getA.status === 200, `status=${getA.status}`);
claim("B's own address answers his sheet", getB.status === 200, `status=${getB.status}`);

// A row id is a small integer and the bank's picture ids are integers too, so the leak test looks
// for things only one customer could have written: his address, his digits, his own words.
const foreignInA = hasAll(getA.text, [B.token, KEY_B, "1100000002", ...DIMS_B, VOTER_B, IMG_B, "مدينتي"]);
const foreignInB = hasAll(getB.text, [A.token, KEY_A, "1000000001", ...DIMS_A, VOTER_A, IMG_A]);
claim("A's answer carries nothing of B", foreignInA.length === 0, foreignInA.join(", "));
claim("B's answer carries nothing of A", foreignInB.length === 0, foreignInB.join(", "));
claim("A's answer really carries A's numbers", getA.text.includes(String(DIMS_A[0])) && getA.text.includes(String(DIMS_A[1])));
claim("no answer echoes the owner key field", !getA.text.includes("customer_key") && !getB.text.includes("customer_key"));
claim("no answer echoes an owner key in its own shape", !getA.text.includes("phone:") && !getB.text.includes("phone:"));

const ownA = getA.body?.sheet?.contact ?? {};
claim("A's sheet says his number is held, without holding it out", ownA.hasPhone === true && !JSON.stringify(ownA).includes("1000000001"));

// A customer typing his own numbers is the witness the store can always answer with — what the
// record holds afterwards is read back out of the record, not from the reply that promised it.
const hisOwn = await sql`
  select customer_dimensions, confirmed_at, ok, failure from room_sketches
  where id in (${ID_A}, ${ID_B}) order by id`;
for (const h of hisOwn) {
  console.log(`sources · sheet ${h.confirmed_at ? "sealed" : "NOT SEALED"} · stored=${JSON.stringify(h.customer_dimensions)} ok=${h.ok} line=${String(h.failure ?? "").slice(0, 46)}`);
}
claim("each customer's own numbers are stored on his own sheet", hisOwn.length === 2 && hisOwn.every((h) => Array.isArray(h.customer_dimensions) && h.customer_dimensions.length === 2));
claim("and his sheet seals on them, in the record", hisOwn.every((h) => Boolean(h.confirmed_at) && h.ok === true));

// ---------------------------------------------------------------- ٢ nobody walks from A to B

console.log("\n== ٢) مفيش طريق من ورقة لورقة ==");
const byIdB = await api(`/api/passport/${ID_B}`);
claim("a row number in the address is refused", byIdB.status === 400 && !byIdB.text.includes(B.token), `status=${byIdB.status}`);

const shapedUnknown = await api(`/api/passport/${"zz".repeat(12)}`);
claim("a well-shaped address with no sheet behind it gets no data", shapedUnknown.status === 404 && !/sheet/.test(shapedUnknown.text), `status=${shapedUnknown.status}`);

const listDoors = [
  "/api/passport",
  "/api/sheet",
  "/api/admin/ops/sketch",
  "/api/admin/ops/sketch?customer_key=" + KEY_A,
  "/api/admin/numbers",
  "/api/admin/settings",
  "/api/elite-leads",
  "/api/leads",
];
for (const door of listDoors) {
  const res = await api(door);
  const leaked = hasAll(res.text, [A.token, B.token, KEY_A, KEY_B, "01000000001", "1000000001"]);
  const refused = res.status === 401 || res.status === 403 || res.status === 404 || res.status === 405 || (res.status >= 300 && res.status < 400);
  // A door that answers 200 to a stranger is only innocent when it hands over zero rows.
  const rowCount = Array.isArray(res.body) ? res.body.length : Array.isArray(res.body?.data) ? res.body.data.length : -1;
  claim(`${door} → ${res.status}${res.loc ? ` → ${res.loc}` : ""} · refused or empty of customer data`, leaked.length === 0 && (refused || rowCount === 0), `rows=${rowCount} ${leaked.join(", ")}`);
}

const adminPage = await api("/admin/v2/ops");
claim(
  "the owner's cockpit hands a passport-less browser no customer data",
  (adminPage.status >= 300 && adminPage.status < 400) || hasAll(adminPage.text, [A.token, B.token, KEY_A, KEY_B]).length === 0,
  `status=${adminPage.status} loc=${adminPage.loc ?? "-"}`,
);

// ---------------------------------------------------------------- ٣ a claimed paper is not stealable

console.log("\n== ٣) ورقة اتعلنت مش بتتسرق ==");
const beforeSteal = await sql`select customer_key from room_sketches where id = ${ID_B}`;
const theft = await post(`/api/passport/${B.token}`, { dimensions: [1.5], customer_phone: PHONE_A });
const afterSteal = await sql`select customer_key, customer_dimensions from room_sketches where id = ${ID_B}`;
console.log(`sources · B's owner key before=${beforeSteal[0].customer_key} after=${afterSteal[0].customer_key} · theft attempt status=${theft.status}`);
claim("the other customer's number cannot take over B's sheet", afterSteal[0].customer_key === KEY_B, `still ${afterSteal[0].customer_key}`);
claim(
  "and a second pair of hands cannot move a sealed sheet's numbers",
  theft.status === 409 && JSON.stringify(afterSteal[0].customer_dimensions) === JSON.stringify(DIMS_B),
  `status=${theft.status} stored=${JSON.stringify(afterSteal[0].customer_dimensions)}`,
);

const contactTheft = await post(`/api/passport/${B.token}/contact`, { phone: PHONE_A, city: "التجمع" });
const afterContact = await sql`select customer_key, customer_city from room_sketches where id = ${ID_B}`;
claim(
  "the contact desk refuses to re-own the paper too",
  afterContact[0].customer_key === KEY_B && afterContact[0].customer_city !== "التجمع",
  `status=${contactTheft.status} key=${afterContact[0].customer_key} city=${afterContact[0].customer_city}`,
);

// ---------------------------------------------------------------- the vote desk speaks of one sheet

console.log("\n== نفس الطابور: غرفة القرار العائلي ==");
const voteA = await post(`/api/passport/${A.token}/votes`, { image_key: IMG_A, image_url: "https://example.com/a.png", voter: VOTER_A, liked: true });
const voteB = await post(`/api/passport/${B.token}/votes`, { image_key: IMG_B, image_url: "https://example.com/b.png", voter: VOTER_B, liked: true });
console.log(`sources · vote recorded A status=${voteA.status} · B status=${voteB.status}`);

const votesOfA = await api(`/api/passport/${A.token}/votes`);
const votesOfB = await api(`/api/passport/${B.token}/votes`);
claim("A's vote desk answers only with A's picture and A's voter", votesOfA.text.includes(IMG_A) && !votesOfA.text.includes(IMG_B) && !votesOfA.text.includes(VOTER_B), `status=${votesOfA.status}`);
claim("B's vote desk answers only with B's picture and B's voter", votesOfB.text.includes(IMG_B) && !votesOfB.text.includes(IMG_A) && !votesOfB.text.includes(VOTER_A), `status=${votesOfB.status}`);
claim("no vote answer echoes an owner key", !votesOfA.text.includes("phone:") && !votesOfB.text.includes("phone:"));

const voteRows = await sql`
  select sketch_id, count(*)::int as n from family_votes
  where sketch_id in (${ID_A}, ${ID_B}) group by sketch_id order by sketch_id`;
console.log(`sources · family_votes rows per sheet: ${voteRows.map((r) => `sketch ${r.sketch_id}=${r.n}`).join(", ") || "none"}`);
claim("the store holds one vote row per sheet, not a shared pot", voteRows.length === 2 && voteRows.every((r) => r.n === 1));

// the counter counts each sheet on its own
for (let i = 0; i < 3; i += 1) {
  await api(`/api/passport/${A.token}`, { headers: { "x-visit-key": "isol-device-cccc" } });
}
const visitRows = await sql`
  select sketch_id, device_key, visit_count from sheet_visits
  where sketch_id in (${ID_A}, ${ID_B}) order by sketch_id, device_key`;
// The row id and the counter's reference can arrive as different JavaScript types (bigint vs integer),
// so the comparison is made on the number, not on whatever the driver happened to hand back.
const num = (v) => Number(v);
console.log(`sources · sheet_visits rows: ${visitRows.map((r) => `sketch ${r.sketch_id}/${String(r.device_key).slice(0, 16)}=${r.visit_count}`).join(", ") || "none"}`);
const aVisits = visitRows.filter((r) => num(r.sketch_id) === num(ID_A));
const bVisits = visitRows.filter((r) => num(r.sketch_id) === num(ID_B));
claim(
  "the return counter counts each sheet's own devices, never another's",
  aVisits.length > 0 && bVisits.length > 0 && aVisits.every((r) => !String(r.device_key).endsWith("bbbb")) && bVisits.every((r) => String(r.device_key).endsWith("bbbb")),
  `A devices=${aVisits.length} B devices=${bVisits.length}`,
);

// ---------------------------------------------------------------- ٤ the database gate answers itself

console.log("\n== ٤) باب القاعدة نفسه بيردّ ==");
const rls = await sql`
  select c.relname, c.relrowsecurity,
         (select count(*)::int from pg_policies p where p.tablename = c.relname) as policies
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname = any(array['room_sketches','family_votes','sheet_visits'])
  order by c.relname`;
for (const r of rls) console.log(`sources · ${r.relname}: row-security=${r.relrowsecurity} policies=${r.policies}`);
claim("the customer's three tables all have the gate switched on", rls.length === 3 && rls.every((r) => r.relrowsecurity), `found=${rls.map((r) => r.relname).join(", ")}`);
const unprotected = await sql`
  select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
  order by c.relname`;
console.log(`sources · tables in the store's record with NO row-security at all (${unprotected.length}): ${unprotected.map((r) => r.relname).join(", ").slice(0, 500) || "none"}`);
claim("no table in the store's record is left without the gate", unprotected.length === 0, `${unprotected.length} without it`);

const supaUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// The tables the census named as the worst of it: a stranger holding only the key the browser ships
// was reading them. Each has to answer with nothing, and with none of my two sheets inside it.
const RECORD_TABLES = [
  "room_sketches",
  "family_votes",
  "sheet_visits",
  "users",
  "leads",
  "agent_messages",
  "consultant_sessions",
  "companies",
  "login_tokens",
  "client_access",
  "elite_sessions",
  "sales_orders",
  "_p6_backup_users",
  "_p7_backup_agent_messages",
];
for (const name of RECORD_TABLES) {
  const res = await fetch(`${supaUrl}/rest/v1/${name}?select=*&limit=3`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let rowCount = -1;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) rowCount = parsed.length;
  } catch {
    /* not a list */
  }
  const mineLeaked = text.includes(A.token) || text.includes(B.token) || text.includes("phone:");
  // Two good answers: the door hands back nothing, or the door refuses the key outright. A 401 is what
  // the privilege lock does, and it is the stronger of the two.
  const refused = res.status === 401 || res.status === 403;
  claim(`${name} · the record answers the public browser key with nothing`, (rowCount === 0 || refused) && !mineLeaked, `status=${res.status} rows=${rowCount} leaked=${mineLeaked}`);
}

const sqlDoor = await fetch(`${supaUrl}/rest/v1/rpc/execute_sql`, {
  method: "POST",
  headers: { apikey: anon, Authorization: `Bearer ${anon}`, "content-type": "application/json" },
  body: JSON.stringify({ sql_query: "select pg_sleep(2)" }),
});
const sqlDoorText = await sqlDoor.text();
claim("a stranger can no longer hand the database a statement", sqlDoor.status === 401 || sqlDoor.status === 404 || sqlDoor.status === 403, `status=${sqlDoor.status} ${sqlDoorText.slice(0, 60)}`);

const rpc = await fetch(`${supaUrl}/rest/v1/rpc/register_sheet_visit`, {
  method: "POST",
  headers: { apikey: anon, Authorization: `Bearer ${anon}`, "content-type": "application/json" },
  body: JSON.stringify({ p_sketch: ID_A, p_device: "forged-device", p_gap_minutes: 30 }),
});
const rpcText = await rpc.text();
claim("a stranger cannot forge a visit row straight at the database", rpc.status === 401 || rpc.status === 403, `status=${rpc.status} ${rpcText.slice(0, 80)}`);

// ---------------------------------------------------------------- no service credential in the browser

console.log("\n== ٥) مفيش مفتاح خدمة في اللي بينزّل على الموبايل ==");
const svcMark = String(env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(0, 16);
let dbPass = "";
try {
  dbPass = new URL(env.DATABASE_URL ?? "").password;
} catch {
  /* leave empty */
}
const html = await api(`/passport/${A.token}`);
const chunkUrls = [...new Set(html.text.match(/\/_next\/static\/[^"']+?\.js/g) ?? [])];
console.log(`sources · page status=${html.status} · scripts referenced=${chunkUrls.length}`);
let scanned = 0;
const hits = [];
for (const src of chunkUrls) {
  const chunk = await fetch(BASE + src);
  const body = await chunk.text();
  scanned += 1;
  if (svcMark && body.includes(svcMark)) hits.push(`${src}: service key`);
  if (body.includes("service_role")) hits.push(`${src}: the word service_role`);
  if (dbPass.length > 5 && body.includes(dbPass)) hits.push(`${src}: database password`);
  if (body.includes(A.token) || body.includes(B.token)) hits.push(`${src}: a passport address`);
}
console.log(`sources · scripts scanned=${scanned} of ${chunkUrls.length}`);
claim("no chunk carries a service credential or a passport address", hits.length === 0, hits.slice(0, 4).join(" | "));
claim("the customer's sheet page itself answers", html.status === 200, `status=${html.status}`);

// ---------------------------------------------------------------- the instrument's own rows leave

console.log("\n== ٦) سطور الآلة بتمشي معها ==");
const storagePaths = [PATH_A, PATH_B].filter(Boolean);
for (const p of storagePaths) {
  const del = await fetch(`${supaUrl}/storage/v1/object/customer-uploads/${p}`, {
    method: "DELETE",
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  console.log(`sources · paper file removed status=${del.status}`);
}
const erased = await sql`delete from room_sketches where id in (${ID_A}, ${ID_B}) returning id`;
const countsAfter = await sql`
  select
    (select count(*)::int from room_sketches) as sketches,
    (select count(*)::int from family_votes) as votes,
    (select count(*)::int from sheet_visits) as visits`;
console.log(`sources · erased ids: ${erased.map((r) => r.id).join(", ")}`);
console.log(`store after · sketches=${countsAfter[0].sketches} votes=${countsAfter[0].votes} visits=${countsAfter[0].visits}`);
claim(
  "the store is counted back exactly to what it was",
  countsAfter[0].sketches === countsBefore[0].sketches &&
    countsAfter[0].votes === countsBefore[0].votes &&
    countsAfter[0].visits === countsBefore[0].visits,
);

console.log(`\n== الخلاصة ==\n${checks - fails} راجع من ${checks} قياس · فاشل ${fails}`);
await sql.end();
process.exit(fails ? 1 : 0);
