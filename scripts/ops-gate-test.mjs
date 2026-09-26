/**
 * ops-gate-test.mjs — does the second factor actually decide anything?
 *
 * `app/api/admin/verify-2fa` signs the admin in with the password *before* it
 * checks the TOTP. The Supabase session lands in the response cookies at that
 * moment, and the guard authorizes an admin from that session alone — so a
 * refusal that leaves the cookies standing is not a refusal.
 *
 * This script refuses itself: right credentials, wrong code, then it asks a
 * guarded admin API and a guarded page with whatever the refusal handed back.
 * Either must come back unauthenticated. A gate that only ever says no is not a
 * gate either, so the last leg answers correctly and must get in.
 *
 * Nothing here prints a secret: the credentials go into a request body built in
 * this process, and only statuses, cookie NAMES and shapes are reported.
 *
 * Usage: node scripts/ops-gate-test.mjs [baseUrl]
 */
import fs from "node:fs";
import speakeasy from "speakeasy";

const BASE = (process.argv[2] || "https://azenith-living.vercel.app").replace(/\/$/, "");
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const email = env.ADMIN_GATE_EMAIL;
const password = env.ADMIN_GATE_PASSWORD;
const secret = (env.ADMIN_GATE_2FA_SECRET || "").trim().replace(/\s+/g, "").toUpperCase();
if (!email || !password || !secret) {
  console.error("ADMIN_GATE_EMAIL, ADMIN_GATE_PASSWORD and ADMIN_GATE_2FA_SECRET are required in .env.local");
  process.exit(2);
}

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
};

/** A cookie that carries a session is one with a non-empty value: a cleared
 * cookie comes back as `name=; Max-Age=0`. Values themselves are never kept. */
const liveSessionCookies = (setCookie) =>
  (setCookie || "")
    .split(/,(?=[^;]+?=)/)
    .filter((chunk) => {
      const [pair] = chunk.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      return /auth-token|access-token|refresh-token/.test(name) && value.length > 0;
    })
    .map((chunk) => chunk.split(";")[0].split("=")[0].trim());

const wrongCode = "000000";
const refused = await fetch(`${BASE}/api/admin/verify-2fa`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, token: wrongCode }),
  signal: AbortSignal.timeout(30_000),
});
const refusedBody = await refused.text();
const jar = (refused.headers.get("set-cookie") || "")
  .split(/,(?=[^;]+?=)/)
  .map((c) => c.split(";")[0])
  .filter(Boolean)
  .join("; ");
const leaked = liveSessionCookies(refused.headers.get("set-cookie"));

record(
  "gate-refuses-a-wrong-code",
  refused.status === 400,
  `status ${refused.status}, ${refusedBody.slice(0, 60)}`,
);
record(
  "refusal-leaves-no-session-behind",
  leaked.length === 0,
  leaked.length ? `session cookies still set: ${leaked.join(", ")}` : "no auth cookie handed back",
);

const guardedApi = await fetch(`${BASE}/api/admin/agents/messages?agent_key=ops-lead`, {
  headers: jar ? { cookie: jar } : {},
  redirect: "manual",
  signal: AbortSignal.timeout(30_000),
});
const guardedBody = await guardedApi.text();
const servedData = guardedApi.status === 200 && guardedBody.includes('"success":true');
record(
  "guarded-api-stays-shut-after-refusal",
  !servedData,
  `status ${guardedApi.status}, ${servedData ? "answered real rows" : guardedBody.slice(0, 40)}`,
);

const guardedPage = await fetch(`${BASE}/admin/v2/agents`, {
  headers: jar ? { cookie: jar } : {},
  redirect: "manual",
  signal: AbortSignal.timeout(30_000),
});
record(
  "guarded-page-stays-shut-after-refusal",
  guardedPage.status !== 200,
  `status ${guardedPage.status}${guardedPage.headers.get("location") ? ` → ${guardedPage.headers.get("location")}` : ""}`,
);

// A gate that never opens is as broken as one that opens for the wrong answer.
// The code is generated here from the configured key — the same key the
// database holds — and is never printed.
const accepted = await fetch(`${BASE}/api/admin/verify-2fa`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email,
    password,
    token: speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }),
  }),
  signal: AbortSignal.timeout(45_000),
});
const acceptedBody = await accepted.json().catch(() => ({}));
const acceptedNames = liveSessionCookies(accepted.headers.get("set-cookie"));
record(
  "gate-opens-for-the-right-code",
  accepted.status === 200 && acceptedBody.success === true && acceptedNames.length > 0,
  `status ${accepted.status}, ${acceptedBody.error ?? `${acceptedNames.length} session cookie(s)`}`,
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed — the gate's second factor ${failed ? "does NOT decide access" : "is load-bearing"} on ${BASE}`);
process.exit(failed ? 1 : 0);
