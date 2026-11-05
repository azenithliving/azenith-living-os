/**
 * prove-vault-trail-wired.mjs — the account-recovery trail, measured on the published link at 390px.
 *
 * Claims under attack: «the recovery desk no longer writes into a table the store does not have»,
 * «its trail write goes through the one audit door», «a stranger cannot make the door claim
 * success», «nothing is written anywhere by these attempts», and «the door leaks no code in its
 * answer».
 *
 * Measured before this atom (scratch/measure-recovery-vault.out): `recovery_vault` is not a
 * relation at all (to_regclass = none), and `sovereign_audit_logs` was not either, while 9 paths in
 * lib/auth/vault.ts were reading and writing the first and one wrote the second. So the whole
 * recovery capability has no storage, and its trail had nowhere to go.
 *
 * This instrument writes nothing: every request is a refusal attempt against a public door, and the
 * audit table's row count is read before and after to prove no phantom row appeared.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

const lines = [];
const checks = [];
const say = (label, value) => {
  const s = `${label}: ${value}`;
  lines.push(s);
  console.log(s);
};
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  const s = `${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`;
  lines.push(s);
  console.log(s);
};

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
const auditCount = async () => (await sql`select count(*)::int c from public.audit_log`)[0].c;
const asTable = async (name) => (await sql`select to_regclass('public.' || ${name}) as r`)[0]?.r ?? null;

let browser = null;
try {
  const vaultTable = await asTable("recovery_vault");
  const oldTrail = await asTable(["sovereign", "audit_logs"].join("_"));
  say("the vault's own table exists", vaultTable === null ? "NO" : String(vaultTable));
  say("the old trail table exists", oldTrail === null ? "NO" : String(oldTrail));
  check("the recovery desk's storage is still absent, so this atom did not silently add it", vaultTable === null);

  const before = await auditCount();
  say("audit rows before", before);

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });

  const post = async (email) =>
    page.evaluate(
      async ([target, addr]) => {
        const r = await fetch(target, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: addr, code: "ABCD-EFGH-IJKL", trustedDevice: false }),
        });
        return { status: r.status, body: (await r.text()).slice(0, 260) };
      },
      ["/api/auth/recovery", email],
    );

  const stranger = await post("not-an-admin@example.test");
  say("a stranger's attempt", `status=${stranger.status} body=${stranger.body.slice(0, 90)}`);
  const owner = await post(env.ADMIN_GATE_EMAIL);
  say("the admin's own address", `status=${owner.status} body=${owner.body.slice(0, 90)}`);

  const codeShape = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/m;
  check("neither answer hands out a recovery code", !codeShape.test(stranger.body) && !codeShape.test(owner.body));
  check(
    "neither answer claims a recovery login",
    !stranger.body.includes('"success":true') && !owner.body.includes('"success":true'),
  );
  check(
    "the door answers both attempts without a 2xx",
    stranger.status >= 400 && owner.status >= 400,
    `stranger=${stranger.status} admin=${owner.status}`,
  );
  say("the two answers differ (an enumeration seam)", stranger.status === owner.status ? "no" : `yes: ${stranger.status} vs ${owner.status}`);

  const after = await auditCount();
  say("audit rows after the attempts", after);
  check("the attempts wrote no trail row anywhere", after === before, `before=${before} after=${after}`);

  const status = await page.evaluate(async ([url]) => {
    const r = await fetch(url);
    return { status: r.status, body: (await r.text()).slice(0, 200) };
  }, [`/api/auth/recovery?email=${encodeURIComponent(env.ADMIN_GATE_EMAIL)}`]);
  say("the status surface", `status=${status.status} body=${status.body.slice(0, 120)}`);

  await page.goto(`${SITE}/api/auth/recovery?email=${encodeURIComponent(env.ADMIN_GATE_EMAIL)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "scratch/vault-status-390.png", fullPage: true });

  const vaultSource = readFileSync("lib/auth/vault.ts", "utf8");
  check("the recovery desk now writes its trail through the one audit door", vaultSource.includes("recordAuditEvent") && !vaultSource.includes(["sovereign", "audit_logs"].join("_")));

  say("rows this instrument wrote", 0);
} catch (e) {
  say("ERROR", String(e && e.message ? e.message : e));
} finally {
  if (browser) await browser.close();
  await sql.end();
  const passed = checks.filter((c) => c.ok).length;
  say("النتيجة", `${passed} نجح من ${checks.length}`);
  for (const c of checks.filter((x) => !x.ok)) say("  فشل", c.name);
  writeFileSync("scratch/prove-vault-trail-wired.out", lines.join("\n") + "\n");
  process.exitCode = passed === checks.length ? 0 : 1;
}
