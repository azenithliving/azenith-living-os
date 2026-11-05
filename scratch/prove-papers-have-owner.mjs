/**
 * prove-papers-have-owner.mjs — the owner's waiting pile, measured on the published link at 390px.
 *
 * Claims under attack: «a paper the assistant puts in front of the owner belongs to his store»,
 * «a paper the desk shows him can actually be decided by him», and «the dashboard and the badge
 * count the same pile». Measured before the fix: 52 of 56 waiting papers had no company at all,
 * and the decision door filtered on the company alone — so those 52 could be seen but never closed.
 * Every row this instrument creates is deleted by its own marker text at the end.
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
const M_CREATED = "ورقة قياس: بتتعمل باب الجديد — مش قرار حقيقي";
const M_ORPHAN = "ورقة قياس: يتيمة قبل الإصلاح — مش قرار حقيقي";
const M_LATE = "ورقة قياس: مستنية من امبارح — مش قرار حقيقي";

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
const myPapers = [];

try {
  if (!COMPANY) throw new Error("ADMIN_COMPANY_ID مش متظبط");

  const shape = async () => (await sql`
    select count(*)::int total,
           count(*) filter (where company_id = ${COMPANY})::int owned,
           count(*) filter (where company_id is null)::int orphan
    from approval_requests where status = 'pending'`)[0];

  const before = await shape();
  say("الورق المستني قبل القياس", `الإجمالي ${before.total} · له شركة ${before.owned} · بلا شركة ${before.orphan}`);

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
    const res = await fetch(u, { ...i, headers: { "Content-Type": "application/json", ...(i && i.headers ? i.headers : {}) } });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, [url, init ?? {}]);

  const created = await call("/api/admin/agents/approval-queue", {
    method: "POST",
    body: JSON.stringify({
      action_type: "probe_created",
      description: M_CREATED,
      risk_level: "normal",
      metadata: { probe: true },
    }),
  });
  const createdId = created.body?.id ?? null;
  say("الباب ردّ على خلق الورقة بحالة", created.status);
  check("الباب خلق ورقة", created.status === 200 && Boolean(createdId), JSON.stringify(created.body ?? {}).slice(0, 120));
  if (createdId) myPapers.push(createdId);
  const createdRow = createdId
    ? await sql`select company_id, status from approval_requests where id = ${createdId}`
    : [];
  check("الورقة الجديدة اتسجّلت باسم المتجر", createdRow[0]?.company_id === COMPANY,
    `قالوا ${(createdRow[0]?.company_id ?? "بلا شركة").slice(0, 8)}`);

  const [orphan] = await sql`
    insert into approval_requests (action_id, action_type, description, risk_level, status, requested_at, expires_at, created_at)
    values (${randomUUID()}, 'probe_orphan', ${M_ORPHAN}, 'normal', 'pending', now(), now() + interval '2 days', now())
    returning id`;
  myPapers.push(orphan.id);
  const afterOrphan = await shape();
  say("بعد سطري اليتيم", `الإجمالي ${afterOrphan.total} · بلا شركة ${afterOrphan.orphan}`);

  const queue = await call("/api/admin/agents/approval-queue");
  const queueIds = (queue.body?.approvals ?? []).map((r) => String(r.id));
  check("مكتب القرار بيشوف الورقة اليتيمة", queueIds.includes(String(orphan.id)), `عدد المعروض ${queueIds.length}`);

  const decided = await call("/api/admin/owner/approval/decision", {
    method: "POST",
    body: JSON.stringify({ approval_id: orphan.id, decision: "approved" }),
  });
  say("باب القرار ردّ بحالة", decided.status);
  check("الورقة اليتيمة اتفصل فيها", decided.status === 200 && decided.body?.success === true,
    JSON.stringify(decided.body ?? {}).slice(0, 140));
  const orphanRow = (await sql`select status, company_id, approved_at from approval_requests where id = ${orphan.id}`)[0];
  check("واتسجلت في الأعمدة الموجودة", orphanRow?.status === "approved" && Boolean(orphanRow?.approved_at), JSON.stringify(orphanRow ?? {}).slice(0, 120));
  check("وأخدت صاحب الدار لما اتفصلت", orphanRow?.company_id === COMPANY,
    `بقت ${(orphanRow?.company_id ?? "بلا شركة").slice(0, 8)}`);

  const [late] = await sql`
    insert into approval_requests (action_id, action_type, description, risk_level, status, requested_at, expires_at, created_at)
    values (${randomUUID()}, 'probe_late', ${M_LATE}, 'normal', 'pending', now() - interval '2 days', now() + interval '1 day', now() - interval '2 days')
    returning id`;
  myPapers.push(late.id);

  const dash1 = await call("/api/admin/owner/dashboard");
  const dashIds = (dash1.body?.data?.pending_decisions ?? []).map((r) => String(r.id));
  check("لوحة المالك بيشوف الورقة اللي ملهاش شركة", dashIds.includes(String(late.id)),
    `عدد المعروض ${dashIds.length}`);
  const overdue = Number(dash1.body?.data?.today?.overdue_papers ?? -1);
  const expectedOverdue = (await sql`
    select count(*)::int c from approval_requests
    where status = 'pending' and requested_at < now() - interval '24 hours'
      and (company_id = ${COMPANY} or company_id is null)`)[0].c;
  check("بلاية الانتظار بتعدّ نفس الدفتر", overdue === expectedOverdue, `الباب قال ${overdue} والعدّاد قال ${expectedOverdue}`);

  // The badge and this screen must be counting one set, read through the same answer.
  const queue2 = await call("/api/admin/agents/approval-queue");
  const deskCount = (queue2.body?.approvals ?? []).length;
  const dashCount = Number(dash1.body?.data?.today?.pending_approvals ?? -1);
  check("العدّاد في الكابينة وفي اللوحة رقم واحد", dashCount === deskCount,
    `اللوحة ${dashCount} · مكتب القرار ${deskCount}`);
  check("اللوحة بتعرض الورق فعلاً", (dash1.body?.data?.pending_decisions ?? []).length > 0,
    `معروض ${(dash1.body?.data?.pending_decisions ?? []).length}`);

  await page.goto(`${SITE}/admin/owner-dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=الموافقات التنفيذية", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  check("الورقة المقاسة ظاهرة على الشاشة", body.includes(M_LATE), body.slice(0, 120));
  check("مفيش كلمة إنجليزية مكان الاسم", !/\bUnknown\b/.test(body));
  const card = page.locator("div", { hasText: "الموافقات التنفيذية" }).last();
  const shot = await card.screenshot({ path: "scratch/papers-have-owner-390.png" }).then(() => true).catch(() => false);
  check("صورة كارت الأوراق اتبّيتت", shot);
  check("مفيش خطأ كونسول على الشاشة", errors.length === 0, errors.join(" | ").slice(0, 200));

  await browser.close();
} catch (e) {
  check("الأداة مشت من غير استثناء", false, String(e && e.stack ? e.stack : e).replace(/\s+/g, " ").slice(0, 400));
} finally {
  if (myPapers.length) {
    await sql`delete from ops_sync_events where event_type in ('approval_granted','approval_rejected') and payload->>'approval_id' = any(${myPapers}::text[])`;
    await sql`delete from approval_requests where id = any(${myPapers}::uuid[])
              and (description = ${M_CREATED} or description = ${M_ORPHAN} or description = ${M_LATE})`;
  }
  const residue = await sql`
    select count(*)::int c from approval_requests
    where description in (${M_CREATED}, ${M_ORPHAN}, ${M_LATE})`;
  say("فاضل من ورقي بعد التنظيف", residue[0].c);
  const after = await sql`
    select count(*)::int total, count(*) filter (where company_id is null)::int orphan
    from approval_requests where status = 'pending'`
;
  say("الورق المستني بعد القياس", `الإجمالي ${after[0].total} · بلا شركة ${after[0].orphan}`);
  await sql.end();
  const failed = checks.filter((c) => !c.ok);
  const summary = `${failed.length === 0 ? "ALL_PASS" : "SOME_FAIL"} — ${checks.length - failed.length}/${checks.length}`;
  lines.push(summary);
  console.log(summary);
  if (failed.length) console.log("FAILED_CHECKS=" + failed.map((f) => f.name).join(" || "));
  writeFileSync("scratch/prove-papers-have-owner.out", lines.join("\n") + "\n");
}
