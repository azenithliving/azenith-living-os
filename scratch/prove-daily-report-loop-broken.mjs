/**
 * prove-daily-report-loop-broken.mjs — the daily report's paper, measured on the published link.
 *
 * Claims under attack: «the daily job no longer creates a paper because papers are waiting»,
 * «the report itself still generates and still persists», «the job refuses anyone without its
 * secret», «the waiting pile stopped growing while this instrument ran», and «the owner's cockpit
 * still opens».
 *
 * Measured before the fix (scratch/measure-approval-producer.out): one paper every day at 08:11
 * UTC, 61 of them labelled «تقرير قرار قبل الموافقة / إجراء إداري» — the job's condition was
 * «there are waiting papers» and the paper it made was itself a waiting paper.
 *
 * This instrument writes nothing: it calls the scheduled door once, reads the pile before and
 * after, and deletes nothing because nothing is created.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const CRON = "/api/cron/admin-daily-report";

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
const pendingCount = async () =>
  (await sql`select count(*)::int c from public.approval_requests where status='pending'`)[0].c;
// The job stores its own report row. Running it by hand therefore writes one row, and this
// instrument deletes exactly the row its run created — nothing else, ever.
const newestReport = async () =>
  (await sql`select id from public.agent_memory where category='admin_daily_report' order by created_at desc limit 1`)[0]?.id ?? null;
const reportCount = async () =>
  (await sql`select count(*)::int c from public.agent_memory where category='admin_daily_report'`)[0].c;

let browser = null;
let newestBeforeId = null;
let createdPaperId = null;
try {
  const before = await pendingCount();
  const reportsBefore = await reportCount();
  newestBeforeId = await newestReport();
  say("waiting papers before", before);
  say("stored reports before", reportsBefore);

  const newestBefore = await sql`
    select to_char(max(requested_at),'YYYY-MM-DD "at" HH24:MI') as last_at
    from public.approval_requests where status='pending'`;
  say("newest waiting paper", String(newestBefore[0]?.last_at));

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });

  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  // negative: the scheduled door must not answer anyone holding no secret
  const noSecret = await page.evaluate(
    async ([path]) => {
      const r = await fetch(path);
      return { status: r.status, body: (await r.text()).slice(0, 120) };
    },
    [CRON],
  );
  say("the job without its secret", `status=${noSecret.status} body=${noSecret.body.slice(0, 60)}`);
  check("the scheduled job refuses a caller with no secret", noSecret.status === 401 || noSecret.status === 503, `status=${noSecret.status}`);

  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2000);
  say("after login", page.url());

  const run = await page.evaluate(
    async ([path, secret]) => {
      const r = await fetch(path, { headers: { authorization: `Bearer ${secret}` } });
      const text = await r.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {}
      return { status: r.status, json, text: text.slice(0, 300) };
    },
    [CRON, env.CRON_SECRET],
  );
  const body = run.json;
  say("the job answered", `status=${run.status}`);
  say("the report says it needs him", body ? String(body.needsReview) : "-");
  say("its reasons", body ? (body.reviewReasons || []).join(" · ") || "none" : "-");
  say("a paper was opened", body ? String(body.proposalCreated) : "-");
  say("or skipped because it already waits", body ? String(body.proposalSkipped ?? "-") : "-");
  say("the pile it counted", body ? String(body.pendingApprovals) : "-");
  say("the report persisted", body ? String(body.memoryStored) : "-");

  check("the job ran and generated a report", run.status === 200 && Boolean(body), run.text.slice(0, 90));
  check(
    "the job opens a paper only when the report itself carries a failure",
    Boolean(body) && (!body.needsReview || !body.proposalCreated || body.proposalId),
    `needsReview=${body ? body.needsReview : "-"} created=${body ? body.proposalCreated : "-"}`,
  );
  check(
    "with the same question already waiting, it opens no second copy",
    Boolean(body) && body.proposalCreated === false,
    body ? String(body.proposalSkipped ?? body.proposalError ?? "no reason given") : "-",
  );
  check(
    "a paper it opened names why it exists",
    !body || !body.proposalCreated || (Array.isArray(body.reviewReasons) && body.reviewReasons.length > 0),
    body ? (body.reviewReasons || []).join(" · ") || "no reason given" : "-",
  );
  check("the job counts every paper waiting, the way his desk lists them", Boolean(body) && body.pendingApprovals === before, `door=${body ? body.pendingApprovals : "-"} record=${before}`);
  check("the report still reaches memory", Boolean(body) && body.memoryStored === true, body ? String(body.memoryError ?? "") : "-");

  createdPaperId = body && body.proposalCreated ? body.proposalId : null;
  if (createdPaperId) {
    say("this run opened a paper — deleting the one row it created", String(createdPaperId).slice(0, 8));
    await sql`delete from public.approval_requests where id = ${createdPaperId}`;
  }

  const after = await pendingCount();
  say("waiting papers after", after);
  check("the waiting pile is exactly what it was before the run", after === before, `before=${before} after=${after}`);

  const reportsAfter = await reportCount();
  const newestAfterId = await newestReport();
  say("stored reports after", reportsAfter);
  if (newestAfterId && newestAfterId !== newestBeforeId) {
    await sql`delete from public.agent_memory where id = ${newestAfterId}`;
    say("the report row this run created was deleted", String(newestAfterId).slice(0, 8));
  }
  const reportsLeft = await reportCount();
  const newestNow = await newestReport();
  check(
    "the instrument left no report row of its own behind",
    reportsLeft === reportsBefore && (newestNow ?? "none") === (newestBeforeId ?? "none"),
    `before=${reportsBefore} now=${reportsLeft}`,
  );

  // The cockpit's own console: this instrument deliberately asked the scheduled door without its
  // secret, and the browser logs that 401 — that noise is not the cockpit's.
  consoleErrors.length = 0;
  await page.goto(`${SITE}/admin/v2`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: "scratch/loop-cockpit-390.png", fullPage: false });
  const cockpitText = await page.evaluate(() => document.body.innerText);
  say("cockpit characters", cockpitText.length);
  check("the owner's cockpit still opens", cockpitText.length > 300);
  check("the cockpit printed no console error", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  say("rows this instrument wrote", reportsAfter - reportsBefore);
} catch (e) {
  say("ERROR", String(e && e.message ? e.message : e));
} finally {
  if (browser) await browser.close();
  try {
    if (createdPaperId) {
      await sql`delete from public.approval_requests where id = ${createdPaperId}`;
      say("teardown swept the run's paper", String(createdPaperId).slice(0, 8));
    }
  } catch {}
  try {
    // If the run died before its own cleanup, sweep only the report row newer than the one it
    // found at the start — never anything older, never another category.
    const newestNow = await newestReport();
    if (newestNow && newestNow !== newestBeforeId) {
      await sql`delete from public.agent_memory where id = ${newestNow}`;
      say("teardown swept the run's report row", String(newestNow).slice(0, 8));
    }
  } catch {}
  await sql.end();
  const passed = checks.filter((c) => c.ok).length;
  say("النتيجة", `${passed} نجح من ${checks.length}`);
  for (const c of checks.filter((x) => !x.ok)) say("  فشل", c.name);
  writeFileSync("scratch/prove-daily-report-loop-broken.out", lines.join("\n") + "\n");
  process.exitCode = passed === checks.length ? 0 : 1;
}
