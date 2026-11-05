/**
 * prove-audit-lands.mjs — the store's audit trail, measured on the published link at 390px.
 *
 * Claims under attack: «an audit event a real door writes actually lands», «the links to the
 * company and the actor are kept, not dropped», «the security stats card counts real events instead
 * of a permanent zero», and «the instrument leaves nothing behind».
 *
 * Measured before the fix (scratch/measure-audit-write.out): the record answers a payload name it
 * does not have with PGRST204, while the desk listened for 42703 — the code a missing read column
 * gives — so its retry never fired, the refusal was dropped, and `audit_log` held zero rows while
 * six doors were writing to it.
 *
 * The stage is a real door: POST /api/admin/agent/ultimate records the command in the audit trail
 * before it dispatches, and an unknown type is answered with 400 and changes nothing else. Every
 * row this instrument creates carries its own marker in `action` and is deleted by that marker, with
 * the leftovers printed before any claim is made.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const MARK = "قياس السجل";

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
const allCount = async () => (await sql`select count(*)::int c from public.audit_log`)[0].c;
const markerRows = async () =>
  await sql`select id, event_type, action, actor, result, details from public.audit_log where action = ${MARK} order by timestamp`;

let browser = null;
let before = 0;

try {
  before = await allCount();
  say("rows before", before);

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });

  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2000);
  say("after login", page.url());

  const post = await page.evaluate(
    async ([marker]) => {
      const r = await fetch("/api/admin/agent/ultimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: marker }),
      });
      return { status: r.status, body: (await r.text()).slice(0, 200) };
    },
    [MARK],
  );
  say("the door answered", `status=${post.status}`);
  check("the real door still refuses an unknown command", post.status === 400, post.body.slice(0, 80));

  const rows = await markerRows();
  say("rows carrying this instrument's marker", rows.length);
  check("the audit event the door wrote actually landed", rows.length === 1, `rows=${rows.length}`);

  const row = rows[0];
  if (row) {
    say("stored event kind", String(row.event_type));
    say("stored event actor", String(row.actor));
    say("stored event result", String(row.result));
    const details = typeof row.details === "string" ? JSON.parse(row.details) : row.details;
    const relation = details && details.relation ? details.relation : null;
    say("links kept inside the payload", relation ? Object.keys(relation).join(",") : "none");
    check("the event keeps its kind, actor and result", row.event_type === "agent_command" && row.result === "success" && Boolean(row.actor));
    check("the company and the actor links ride inside the payload column", Boolean(relation) && Boolean(relation.companyId) && Boolean(relation.actorUserId), relation ? Object.keys(relation).join(",") : "no relation block");
  }

  const stats = await page.evaluate(async () => {
    const r = await fetch("/api/admin/agent/ultimate?action=security");
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: r.status, json, text: text.slice(0, 200) };
  });
  const counted = stats.json && stats.json.stats ? stats.json.stats.totalAuditEvents : null;
  const nowTotal = await allCount();
  say("the security stats card counts", String(counted));
  say("the record itself holds", nowTotal);
  check("the card counts what the record holds, not a standing zero", counted === nowTotal && nowTotal > before, `card=${counted} record=${nowTotal} before=${before}`);

  await page.goto(`${SITE}/api/admin/agent/ultimate?action=security`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "scratch/audit-stats-390.png", fullPage: true });
  const glass = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 300);
  say("the stats on the glass", glass.slice(0, 160));
  check("the stats answer is readable on the glass at phone width", glass.includes("totalAuditEvents"));

  say("cleanup", "deleting only the rows this instrument marked");
  await sql`delete from public.audit_log where action = ${MARK}`;
  const leftovers = await markerRows();
  const after = await allCount();
  say("my rows left", leftovers.length);
  say("rows after cleanup", after);
  check("the instrument left no row of its own behind", leftovers.length === 0 && after === before, `left=${leftovers.length} after=${after} before=${before}`);

  // The board's own console: this instrument deliberately provoked a 400 from the command door
  // above, and the browser logs a failed fetch — that noise is not the board's.
  consoleErrors.length = 0;
  await page.goto(`${SITE}/admin/owner-dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "scratch/audit-dashboard-390.png", fullPage: false });
  const boardText = await page.evaluate(() => document.body.innerText);
  say("board characters", boardText.length);
  check("the owner's board opens clean after the rewrite", boardText.length > 300);
  check("the board printed no console error", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} catch (e) {
  say("ERROR", String(e && e.message ? e.message : e));
} finally {
  if (browser) await browser.close();
  try {
    const leftovers = await markerRows();
    if (leftovers.length > 0) {
      await sql`delete from public.audit_log where action = ${MARK}`;
      say("teardown swept", leftovers.length);
    }
  } catch {}
  await sql.end();

  const passed = checks.filter((c) => c.ok).length;
  say("النتيجة", `${passed} نجح من ${checks.length}`);
  for (const c of checks.filter((x) => !x.ok)) say("  فشل", c.name);
  writeFileSync("scratch/prove-audit-lands.out", lines.join("\n") + "\n");
  process.exitCode = passed === checks.length ? 0 : 1;
}
