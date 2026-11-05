import { readFileSync } from "node:fs";

/**
 * The instrument's own pictures leave with the instrument.
 *
 * Every sheet minted by the isolation proof uploaded a one-pixel paper into `customer-uploads`, and the
 * delete the proof ran answered 400 — so the files stayed behind while their rows were erased. This
 * lists the objects by the numbers the instruments dictate (they are not real customers' numbers),
 * shows them, and removes exactly those.
 *
 *   node scratch/sweep-the-instrument-papers.mjs
 */

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const BUCKET = "customer-uploads";
const PROBE_DIGITS = ["1000000001", "1100000002", "1000000007"];
const headers = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "content-type": "application/json",
};

async function list(prefix) {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: "name", order: "asc" } }),
  });
  if (!res.ok) throw new Error(`list ${prefix} → ${res.status} ${String(await res.text()).slice(0, 120)}`);
  return res.json();
}

const root = await list("sketches/");
const companyDirs = root.filter((r) => r.id === null).map((r) => r.name);
const mine = [];
for (const dir of companyDirs) {
  const rows = await list(`sketches/${dir}/`);
  for (const r of rows) if (PROBE_DIGITS.some((d) => String(r.name).includes(d))) mine.push(`sketches/${dir}/${r.name}`);
}

console.log(`sources · folders of papers=${companyDirs.length} · objects carrying an instrument's number=${mine.length}`);
for (const path of mine) {
  // The cabinet refuses a DELETE that carries a JSON content-type with no body — the header belongs to
  // the list calls above, not to this one.
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "DELETE",
    headers: { apikey: headers.apikey, Authorization: headers.Authorization },
  });
  console.log(`removed · ${path.slice(0, 60)}… · status=${res.status}`);
}

const after = await list("sketches/");
let left = 0;
for (const dir of after.filter((r) => r.id === null).map((r) => r.name)) {
  const rows = await list(`sketches/${dir}/`);
  left += rows.filter((r) => PROBE_DIGITS.some((d) => String(r.name).includes(d))).length;
}
console.log(`\nverdict · instrument papers left in the cabinet: ${left}`);
process.exit(left === 0 ? 0 : 1);
