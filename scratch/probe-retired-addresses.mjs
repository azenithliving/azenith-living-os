/**
 * Live probe of the address guard: does every retired address the store ever published still
 * answer, on the published site, with no dead link? Read-only — nothing is written anywhere.
 */
const BASE = "https://azenith-living.vercel.app";

const CASES = [
  { url: "/admin/qayyim", expect: "/admin/v2/ops" },
  { url: "/admin/v2/qayyim", expect: "/admin/v2/ops" },
  { url: "/admin/v2/agents/qayyim", expect: "/admin/v2/agents/ops" },
  { url: "/admin/manufacturing", expect: "/admin/agents" },
  { url: "/admin/sales?tab=leads&expand=1", expect: "/admin/v2/sales?expand=1" },
  { url: "/admin/v2/agents/ops?agent=qayyim-core", expect: "agent=ops-lead" },
  { url: "/admin/v2/agents/ops?agent=qayyim-vis", expect: "agent=ops-visual" },
  { url: "/admin/v2/agents/ops?agent=prime", expect: "agent=ops-lead" },
  { url: "/admin/qayyim/", expect: "/admin/v2/ops" },
  { url: "/api/admin/qayyim/preview/zzz", expect: "answered (not 404)" },
  { url: "/admin/agents/qayyim", expect: "answered (not 404)" },
];

let dead = 0;
let answered = 0;
for (const c of CASES) {
  const res = await fetch(BASE + c.url, { redirect: "manual", signal: AbortSignal.timeout(45000) }).catch((e) => null);
  if (!res) {
    console.log(`DEAD  ${c.url} — no answer`);
    dead++;
    continue;
  }
  const location = res.headers.get("location") ?? "";
  const status = res.status;
  const ok =
    c.expect === "answered (not 404)"
      ? status !== 404 && status !== 500
      : (status === 308 || status === 307 || status === 301) && location.includes(c.expect);
  if (ok) answered++;
  else dead++;
  console.log(`${ok ? "OK  " : "FAIL"} ${status} ${c.url} → ${location || "(no location)"} · expected ${c.expect}`);
}

console.log(`\nretired addresses probed: ${CASES.length} · answered right: ${answered} · dead or wrong: ${dead}`);
process.exit(dead === 0 ? 0 : 1);
