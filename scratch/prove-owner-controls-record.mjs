/**
 * prove-owner-controls-record.mjs — the stop control and the decision control, measured on the
 * published link at 390px.
 *
 * The claims under attack: «pressing the owner's stop does what it says, counts what it actually
 * cancelled, and leaves a record his alert strips can read», and «his yes/no on a waiting paper
 * lands in the column the record answers to». Both were false: the stop aimed at two tables that
 * do not exist and answered 500, and the decision wrote three columns that do not exist.
 *
 * The stop really cancels tasks, so this instrument takes a checkpoint of every open task first,
 * restores those rows by id afterwards, and deletes only the rows it created itself.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const COMPANY = env.ADMIN_COMPANY_ID?.trim();
const MARK = "قياس حيّ للإيقاف — مش تنبيه حقيقي";
const TASK_TITLE = "سطر قياس للإيقاف — مش مهمة حقيقية";
const PAPER_DESC = "سطر قياس لورقة مستنية — مش قرار حقيقي";
const OPEN_STATUSES = ["running", "queued", "pending"];

const lines = [];
const checks = [];
const say = (label, value) => { const s = `${label}: ${value}`; lines.push(s); console.log(s); };
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  const s = `${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`;
  lines.push(s);
  console.log(s);
};

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
const runStart = new Date().toISOString();
const mine = { taskIds: [], approvalIds: [], ledgerIds: [] };
let checkpoint = [];

try {
  if (!COMPANY) throw new Error("ADMIN_COMPANY_ID مش متظبط");

  const fks = await sql`
    select conname, pg_get_constraintdef(oid) d from pg_constraint
    where conrelid = 'approval_requests'::regclass and contype = 'f'`;
  say("مفاتيح غريبة على جدول القرارات", fks.length ? fks.map((f) => f.d).join(" | ") : "مفيش");

  checkpoint = await sql`
    select id, status, updated_at, error_message from agent_tasks
    where company_id = ${COMPANY} and status = any(${OPEN_STATUSES}::text[])`;
  writeFileSync("scratch/checkpoint-agent-tasks.json", JSON.stringify(checkpoint, null, 2) + "\n");
  say("مهام مفتوحة قبل القياس", checkpoint.length);

  const [myTask] = await sql`
    insert into agent_tasks (company_id, task_type, title, status)
    values (${COMPANY}, 'probe', ${TASK_TITLE}, 'pending') returning id`;
  mine.taskIds.push(myTask.id);
  const openBefore = checkpoint.length + 1;
  say("اللي المفروض الإيقاف يلغيه", openBefore);

  const [myPaper] = await sql`
    insert into approval_requests (action_id, action_type, description, risk_level, status, company_id)
    values (${randomUUID()}, 'probe', ${PAPER_DESC}, 'normal', 'pending', ${COMPANY}) returning id`;
  mine.approvalIds.push(myPaper.id);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4000);
  await page.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
  await page.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
  await page.click("button[type=submit]");
  for (let i = 0; i < 25 && !page.url().includes("/admin"); i++) await page.waitForTimeout(2000);
  check("البوابة فتحت", page.url().includes("/admin"), page.url().replace(SITE, ""));

  const call = (url, init) => page.evaluate(async ([u, i]) => {
    const res = await fetch(u, { ...i, headers: { "Content-Type": "application/json", ...(i.headers || {}) } });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, [url, init ?? {}]);

  const stopBefore = await call("/api/admin/owner/emergency-stop");
  say("حالة الإيقاف قبل الضغط", JSON.stringify(stopBefore.body?.data ?? stopBefore.body).slice(0, 120));
  check("الباب بيقرا حالته من الدفتر", stopBefore.status === 200 && stopBefore.body?.success === true);

  const trigger = await call("/api/admin/owner/emergency-stop", {
    method: "POST",
    body: JSON.stringify({ action: "trigger", reason: MARK }),
  });
  say("الإيقاف ردّ بحالة", trigger.status);
  check("الإيقاف اتنفّذ من غير ما يرمي خطأ", trigger.status === 200 && trigger.body?.success === true,
    JSON.stringify(trigger.body ?? {}).slice(0, 140));
  check("وعدد اللي اتلغى من ردّ القاعدة مش من الكلام",
    Number(trigger.body?.data?.cancelled) === openBefore, `قال ${trigger.body?.data?.cancelled} والسجل قال ${openBefore}`);
  check("والإيقاف اتسجّل في الدفتر", trigger.body?.recorded === true);

  const [stopRow] = await sql`
    select id, payload from ops_sync_events
    where event_type = 'emergency_stop' and payload->>'reason' = ${MARK} order by id desc limit 1`;
  check("سطر الدفتر موجود وفيه العدد نفسه", stopRow && Number(stopRow.payload?.cancelled) === openBefore);
  if (stopRow) mine.ledgerIds.push(stopRow.id);

  const cancelledBack = await sql`
    select count(*)::int c from agent_tasks where company_id = ${COMPANY} and status = any(${OPEN_STATUSES}::text[])`;
  check("مفيش مهمة مفتوحة فضلت بعد الإيقاف", cancelledBack[0].c === 0, `فاضل ${cancelledBack[0].c}`);

  const strip = await call("/api/admin/notifications?limit=20");
  const stripTitles = (strip.body?.data ?? []).map((n) => n.title);
  check("شريط التنبيهات شاف الإيقاف", stripTitles.includes("الإيقاف الطارئ اتفعّل — الموظفين واقفين"),
    stripTitles.join(" | ").slice(0, 160));
  const cockpit = await call("/api/admin/agents/alerts");
  check("الشريط الأحمر عدّه زيه بالضبط", cockpit.body?.count === strip.body?.data?.length,
    `الجديدة ${cockpit.body?.count} · القديمة ${strip.body?.data?.length}`);

  const stopAfter = await call("/api/admin/owner/emergency-stop");
  check("الباب بيقول الدار واقفة دلوقتي", stopAfter.body?.data?.stopped === true,
    JSON.stringify(stopAfter.body?.data ?? {}).slice(0, 120));

  // The real button, through the real sidebar, at his width. At 390px the sidebar is a drawer,
  // so the instrument opens it the way he does before reaching for the control.
  errors.length = 0;
  await page.goto(`${SITE}/admin/v2/ops`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(9000);
  const [extraTask] = await sql`
    insert into agent_tasks (company_id, task_type, title, status)
    values (${COMPANY}, 'probe', ${TASK_TITLE}, 'pending') returning id`;
  mine.taskIds.push(extraTask.id);

  const hamburger = page.getByRole("button", { name: "افتح قائمة الأقسام" });
  if ((await hamburger.count()) > 0) {
    await hamburger.first().click();
    await page.waitForTimeout(1500);
  }
  const stopButton = page.getByRole("button", { name: /إيقاف فوري/ }).first();
  const hasButton = (await stopButton.count()) > 0;
  check("زرار الإيقاف موجود في كابينة القيادة على عرض الموبايل", hasButton, page.url().replace(SITE, ""));
  if (hasButton) {
    await stopButton.click();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /اضغط تاني للتأكيد/ }).first().click({ timeout: 15000 });
    // The door answers after cancelling rows and writing the receipt; on a cold function that is
    // longer than any fixed wait I would pick, so the instrument waits for the sentence itself.
    const newsLine = page.locator("p", { hasText: "الدار واقفة" }).first();
    const newsShown = await newsLine.waitFor({ state: "visible", timeout: 60000 }).then(() => true).catch(() => false);
    check("الباب ردّ على الشاشة بجملة", newsShown);
    const news = newsShown ? await newsLine.innerText().catch(() => "") : "";
    check("الشريط قال العدد اللي اتلغى فعلاً", news.includes("اتلغت") && news.includes("١"),
      news.replace(/\s+/g, " ").slice(0, 160));
    check("الكلام كله عربي بحروف عربية", /[\u0660-\u0669]/.test(news) && !/[A-Za-z0-9]/.test(news),
      news.replace(/\s+/g, " ").slice(0, 120));
    // The defect this run exists to catch: the arming timer used to wipe the reply. The sentence
    // must still be there after its three-second window has passed.
    await page.waitForTimeout(4500);
    const stillThere = await newsLine.innerText().catch(() => "");
    check("الرد فضل قدامه بعد ما نافذة التسلح خلصت", stillThere.includes("الدار واقفة"),
      stillThere.replace(/\s+/g, " ").slice(0, 120));
    // The sentence sits at the bottom of a drawer taller than his screen, so an element shot
    // captures a box the viewport has already clipped. Scroll it into view and shoot what he sees.
    await newsLine.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1200);
    const shot = await page.screenshot({ path: "scratch/owner-stop-door-390.png" }).then(() => true).catch(() => false);
    check("صورة الشاشة كاملة والجملة ظاهرة اتبّيتت", shot && newsShown);
    // Footsteps first: my own refused probes below log a 400 in the browser, and that is not a
    // defect on his screen. This count belongs to the settled cockpit.
    const cockpitErrors = errors.splice(0, errors.length);
    check("مفيش خطأ كونسول في شاشة الكابينة", cockpitErrors.length === 0, cockpitErrors.join(" | ").slice(0, 200));
    const [secondStop] = await sql`
      select id from ops_sync_events where event_type = 'emergency_stop' and payload->>'reason' = 'من كابينة القيادة'
      and created_at > ${runStart}::timestamptz order by id desc limit 1`;
    if (secondStop) mine.ledgerIds.push(secondStop.id);
    check("ضغطة الزرار اتسجّلت هي كمان", Boolean(secondStop));
  }

  const release = await call("/api/admin/owner/emergency-stop", {
    method: "POST",
    body: JSON.stringify({ action: "release", reason: MARK }),
  });
  check("رفع الإيقاف اتسجّل", release.status === 200 && release.body?.success === true && release.body?.recorded === true,
    JSON.stringify(release.body ?? {}).slice(0, 120));
  const [releaseRow] = await sql`
    select id from ops_sync_events where event_type = 'emergency_stop_released' and payload->>'reason' = ${MARK}
    order by id desc limit 1`;
  if (releaseRow) mine.ledgerIds.push(releaseRow.id);
  check("الرفع بقى هو الأحدث فالدار مش واقفة", Boolean(releaseRow));
  const stopNow = await call("/api/admin/owner/emergency-stop");
  check("الباب بيرجع يقول مفيش إيقاف", stopNow.body?.data?.stopped === false);

  const decision = await call("/api/admin/owner/approval/decision", {
    method: "POST",
    body: JSON.stringify({ approval_id: myPaper.id, decision: "approved" }),
  });
  say("القرار ردّ بحالة", decision.status);
  check("كلمة المالك اتنفّذت", decision.status === 200 && decision.body?.success === true,
    JSON.stringify(decision.body ?? {}).slice(0, 140));
  check("والقرار اتسجّل في الدفتر", decision.body?.recorded === true);
  const [paperAfter] = await sql`
    select status, approved_by, approved_at from approval_requests where id = ${myPaper.id}`;
  check("الأعمدة الموجودة فعلاً هي اللي اتكتبت",
    paperAfter?.status === "approved" && paperAfter?.approved_by && paperAfter?.approved_at,
    JSON.stringify(paperAfter ?? {}).slice(0, 140));
  const [decisionRow] = await sql`
    select id from ops_sync_events where event_type = 'approval_granted' and payload->>'approval_id' = ${myPaper.id}
    order by id desc limit 1`;
  if (decisionRow) mine.ledgerIds.push(decisionRow.id);
  check("القرار ليّه سطر في الدفتر", Boolean(decisionRow));

  const twice = await call("/api/admin/owner/approval/decision", {
    method: "POST",
    body: JSON.stringify({ approval_id: myPaper.id, decision: "rejected" }),
  });
  check("الورقة اللي اتفصل فيها ما تتكررش", twice.status === 400);
  check("والرفض بالعربي", /[\u0600-\u06FF]/.test(String(twice.body?.error ?? "")), String(twice.body?.error ?? "").slice(0, 90));

  const anon = await chromium.launch({ headless: true });
  const anonCtx = await anon.newContext({ viewport: { width: 390, height: 900 } });
  const anonRes = await anonCtx.request.post(`${SITE}/api/admin/owner/emergency-stop`, {
    data: { action: "trigger", reason: "anon-probe" },
    headers: { "Content-Type": "application/json" },
  });
  say("زائر بلا جلسة على زرار الإيقاف", anonRes.status());
  check("الباب مقفول على زائر بلا جلسة", anonRes.status() === 401);
  const anonOpen = await sql`select count(*)::int c from agent_tasks where company_id = ${COMPANY} and status = any(${OPEN_STATUSES}::text[])`;
  check("والضغطته ما لغتش حاجة", anonOpen[0].c === 0, `فاضل مفتوح ${anonOpen[0].c}`);
  await anon.close();

  await browser.close();
} catch (e) {
  check("الأداة مشت من غير استثناء", false, String(e && e.stack ? e.stack : e).replace(/\s+/g, " ").slice(0, 400));
} finally {
  for (const id of checkpoint) {
    await sql`
      update agent_tasks set status = ${id.status}, updated_at = ${id.updated_at}, error_message = ${id.error_message}
      where id = ${id.id}`;
  }
  if (mine.taskIds.length) await sql`delete from agent_tasks where id = any(${mine.taskIds}::uuid[]) and title = ${TASK_TITLE}`;
  if (mine.approvalIds.length) await sql`delete from approval_requests where id = any(${mine.approvalIds}::uuid[]) and description = ${PAPER_DESC}`;
  if (mine.ledgerIds.length) await sql`delete from ops_sync_events where id = any(${mine.ledgerIds}::bigint[])`;

  const restored = await sql`
    select count(*)::int c from agent_tasks
    where id = any(${checkpoint.map((r) => r.id)}::uuid[]) and status = 'pending'`;
  say("المهام الرجعت بحالتها", restored[0].c + " من " + checkpoint.length);
  const residueTasks = await sql`select count(*)::int c from agent_tasks where title = ${TASK_TITLE}`;
  const residuePapers = await sql`select count(*)::int c from approval_requests where description = ${PAPER_DESC}`;
  const residueLedger = await sql`
    select count(*)::int c from ops_sync_events
    where payload::text like ${`%${MARK}%`} or payload::text like ${`%من كابينة القيادة%`}
       or payload->>'approval_id' = any(${mine.approvalIds}::text[])`;
  say("فاضل من سطري: مهام", residueTasks[0].c);
  say("فاضل من سطري: ورق قرارات", residuePapers[0].c);
  say("فاضل من سطري: سطور الدفتر", residueLedger[0].c);
  await sql.end();

  const failed = checks.filter((c) => !c.ok);
  const summary = `${failed.length === 0 ? "ALL_PASS" : "SOME_FAIL"} — ${checks.length - failed.length}/${checks.length}`;
  lines.push(summary);
  console.log(summary);
  if (failed.length) console.log("FAILED_CHECKS=" + failed.map((f) => f.name).join(" || "));
  writeFileSync("scratch/prove-owner-controls.out", lines.join("\n") + "\n");
}
