/**
 * prove-gate-note-lands.mjs — the quality gate refusal, measured on the published link.
 *
 * Claims under attack:
 *   1. before the fix, every refusal row in the store's own ledger carried an empty reason list,
 *   2. a refusal made now through the real door lands with a non-empty list and an Arabic summary,
 *   3. the strip's own door can print that summary as a note,
 *   4. the instrument leaves nothing behind, and his cockpit still renders at phone width.
 *
 * Rows this run creates are deleted by the marker it put in their own payload, and the leftover
 * count is printed before any claim is made.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const MARK = "قياس-بوابة-الجودة";

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
let browser = null;

try {
  const old = await sql`
    select count(*)::int c,
           count(*) filter (where jsonb_array_length(coalesce(payload->'violations','[]'::jsonb)) = 0) empty_list
    from public.ops_sync_events
    where event_type='quality_gate_failed'`;
  say("refusal rows already in the ledger", `${Number(old[0].c)} · empty reason list: ${Number(old[0].empty_list)}`);
  check(
    "the old refusals really carried nothing",
    Number(old[0].c) > 0 && Number(old[0].empty_list) === Number(old[0].c),
    `rows=${old[0].c} empty=${old[0].empty_list}`
  );

  const beforeMine = await sql`select count(*)::int c from public.ops_sync_events where payload->>'draftId'=${MARK}`;
  say("rows with this run's marker before", beforeMine[0].c);

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

  const ran = await page.evaluate(async ([marker]) => {
    const r = await fetch("/api/admin/ops?action=constitution", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentKey: "ops-lead",
        actionType: "publish",
        content: "",
        proposedChanges: [],
        targetPage: "",
        targetSection: "",
        evidenceUrls: [],
        humanApproval: false,
        draft_id: marker,
      }),
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    const report = json?.constitution_report ?? null;
    return {
      status: r.status,
      allowed: report ? report.overallPassed : null,
      blocking: report && Array.isArray(report.blockingViolations) ? report.blockingViolations.length : -1,
      head: text.slice(0, 120),
    };
  }, [MARK]);

  say("the door's constitution check", `status=${ran.status} allowed=${String(ran.allowed)} blocking=${ran.blocking}`);
  check("the door refused the work and named why", ran.status === 200 && ran.allowed === false && ran.blocking > 0, ran.head);

  await page.waitForTimeout(2500);

  const row = await sql`
    select id, event_type, payload->>'draftId' as draft, payload->'violations' as violations, payload->>'summary' as summary
    from public.ops_sync_events
    where payload->>'draftId'=${MARK} and event_type='quality_gate_failed'
    order by created_at desc limit 1`;
  if (!row.length) {
    say("the ledger row this refusal wrote", "none");
    checks.push({ name: "the refusal wrote a ledger row", ok: false });
  } else {
    const list = row[0].violations ?? [];
    const summary = String(row[0].summary ?? "");
    say("the ledger row this refusal wrote", `id=${row[0].id} draft=${row[0].draft} reasons=${list.length} summary bytes=${summary.length}`);
    check("the row names the draft it refused", row[0].draft === MARK, String(row[0].draft));
    check("the row carries the reasons that blocked", Array.isArray(list) && list.length > 0, `reasons=${list.length}`);
    check("the row carries an Arabic sentence the strip can print", /[\u0600-\u06FF]/.test(summary) && summary.length > 8, summary.slice(0, 90));
  }

  // The strip's own door. Measured shape: { success, data: [{ id, title, message, type }], unreadCount }.
  const myId = row && row.length ? Number(row[0].id) : -1;
  const strip = await page.evaluate(async ([wantId]) => {
    const r = await fetch("/api/admin/notifications?limit=100");
    const json = await r.json().catch(() => null);
    const list = Array.isArray(json?.data) ? json.data : [];
    const gate = list.filter((a) => String(a?.title ?? "").includes("بوابة الجودة"));
    const mine = list.find((a) => Number(a?.id) === Number(wantId)) ?? null;
    return { status: r.status, total: list.length, gate: gate.length, mine, unread: json?.unreadCount ?? null };
  }, [myId]);

  say("the strip's door", `status=${strip.status} items=${strip.total} gate items=${strip.gate} unread=${strip.unread}`);
  check("the strip reads this refusal as an alert", strip.status === 200 && Boolean(strip.mine), `found=${Boolean(strip.mine)}`);
  const sampleNote = strip.mine ? String(strip.mine.message ?? "") : "";
  say("the refusal alert's line", sampleNote.slice(0, 120) || "(blank)");
  check(
    "the alert says what was refused in his Arabic",
    /[\u0600-\u06FF]/.test(sampleNote) && sampleNote.includes("سبب يمنع النشر"),
    `bytes=${sampleNote.length}`
  );

  // Cleanup: only rows carrying this run's own marker.
  const mine = await sql`select id from public.ops_sync_events where payload->>'draftId'=${MARK}`;
  const ids = mine.map((m) => m.id);
  if (ids.length) await sql`delete from public.ops_sync_events where id = ANY(${ids})`;
  const left = await sql`select count(*)::int c from public.ops_sync_events where payload->>'draftId'=${MARK}`;
  say("rows this run wrote", ids.length);
  say("rows left behind", left[0].c);
  check("the instrument cleaned its own rows", left[0].c === 0);

  consoleErrors.length = 0;
  await page.goto(`${SITE}/admin/v2`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const chars = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").length);
  say("cockpit text at 390px", chars);
  check("the cockpit renders", chars > 400, `chars=${chars}`);
  check("no console error on the cockpit", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  await page.screenshot({ path: "scratch/gate-note-cockpit-390.png", fullPage: false });
} catch (error) {
  say("INSTRUMENT ERROR", String(error && error.message ? error.message : error).slice(0, 200));
  checks.push({ name: "instrument completed", ok: false });
} finally {
  if (browser) await browser.close().catch(() => {});
  await sql.end({ timeout: 5 }).catch(() => {});
  const passed = checks.filter((c) => c.ok).length;
  say("RESULT", `${passed} of ${checks.length}`);
  writeFileSync("scratch/prove-gate-note-lands.out", lines.join("\n") + "\n");
}
