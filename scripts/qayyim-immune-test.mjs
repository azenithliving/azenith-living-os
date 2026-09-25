/**
 * qayyim-immune-test.mjs — proves the P6-M5 organs actually run on production.
 *
 * Two rules shape this file:
 *  1. Secrets are read from the environment and never printed. Only the presence
 *     of a secret and the shape of a response get reported.
 *  2. Nothing here trusts the thing it is testing. The canary reports its own
 *     probes, and this script probes the same pages again from the outside — if
 *     the canary ever reports "all clear" while the site is down, the two lists
 *     disagree and this run fails.
 *
 * Usage: set CRON_SECRET and INTERNAL_API_KEY, then
 *   node scripts/qayyim-immune-test.mjs [baseUrl]
 */

const BASE = (process.argv[2] || "https://azenith-living.vercel.app").replace(/\/$/, "");
const CRON = process.env.CRON_SECRET;
const KEY = process.env.INTERNAL_API_KEY;
if (!CRON || !KEY) {
  console.error("CRON_SECRET and INTERNAL_API_KEY are required in the environment");
  process.exit(2);
}

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
};

async function postCron(step) {
  const res = await fetch(`${BASE}/api/cron/qayyim-daily?only=${step}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CRON}` },
    signal: AbortSignal.timeout(90_000),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// 1 — the canary runs and reports real numbers, not a story.
const canary = await postCron("canary");
const c = canary.body?.results?.canary;
record(
  "canary-runs",
  canary.status === 200 && canary.body?.success === true && !!c && c.checked >= 1,
  `status ${canary.status}, ${c ? `checked ${c.checked}/${c.checked + c.skipped}, failed ${c.failed}` : "no canary in the round results"}`,
);

// 2 — independent evidence. The script probes the same pages itself; the canary
// may not claim a healthy page that this run cannot open.
const pages = ["/", "/rooms", "/about", "/request", "/privacy"];
const independent = [];
for (const path of pages) {
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
    independent.push({ path, status: res.status });
  } catch (e) {
    independent.push({ path, status: null });
  }
}
const unreachable = independent.filter((p) => !(p.status >= 200 && p.status < 300));
record(
  "storefront-opens",
  unreachable.length === 0,
  unreachable.length ? `not 2xx: ${unreachable.map((p) => `${p.path}=${p.status}`).join(", ")}` : `all ${pages.length} pages answered 2xx from outside`,
);
const canaryBlind = c && c.failed === 0 && unreachable.length > 0;
record(
  "canary-not-blind",
  !!c && !canaryBlind,
  canaryBlind ? `canary said all clear while ${unreachable.length} page(s) failed here` : "canary agrees with the outside probe",
);

// 3 — the self-audit runs, samples, and writes its own row.
const audit = await postCron("audit");
const a = audit.body?.results?.selfAudit;
record(
  "audit-runs",
  audit.status === 200 && audit.body?.success === true && !!a && typeof a.sampled === "number",
  `status ${audit.status}, ${a ? `sampled ${a.sampled}, judged ${a.judged}, avg ${a.avgScore}` : "no selfAudit in the round results"}`,
);
// An audit that judged nothing must say why instead of reporting a clean sheet.
record(
  "audit-honest-when-empty",
  !!a && (a.judged > 0 || (a.note || "").length > 10),
  a?.judged ? `${a.judged} graded` : `note: ${a?.note ?? "none"}`,
);

const bm = await fetch(`${BASE}/api/admin/qayyim/benchmarks`, { headers: { "x-internal-key": KEY } });
const bmBody = await bm.json().catch(() => ({}));
const runs = (bmBody.recent_runs || []).filter((r) => r.benchmark_key === "owner_reply_audit");
record(
  "audit-persisted",
  bmBody.success === true && runs.length > 0,
  runs.length ? `${runs.length} owner_reply_audit row(s), latest score ${runs[0].score}` : "no audit row came back from the benchmarks API",
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
