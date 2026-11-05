/**
 * prove-alert-strip.mjs — the owner's alert strip, measured on the published link at 390px.
 *
 * The claim under attack: «the strip shows trouble the store actually recorded, and marking it read
 * works». The old strip read a table whose live shape has no severity and no read flag, so its button
 * failed on every press and its rows were four demo alerts seeded on 2026-08-10. This instrument puts
 * ONE real alert into the store's ledger, reads it back through BOTH surfaces that must agree, closes
 * it, and then removes exactly the rows it wrote.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const ALERT_TYPES = [
  "anomaly_detected", "identity_violation", "scope_violation", "quality_gate_failed", "agent_task_failed",
  "system:anomaly_detected", "system:error", "tool:failed", "workflow:failed", "task:failed",
];
const ACK_TYPE = "owner_alert_acknowledged";
const MARK = "سطر قياس حيّ للشريط — مش تنبيه حقيقي";
const COMPANY = env.ADMIN_COMPANY_ID?.trim();

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
let markId = null;
let ackRows = 0;

try {
  if (!COMPANY) throw new Error("ADMIN_COMPANY_ID مش متظبط في البيئة");

  const openCount = async () => (await sql`
    select count(*)::int c from ops_sync_events e
    where e.company_id = ${COMPANY}
      and e.event_type = any(${ALERT_TYPES}::text[])
      and e.created_at > now() - interval '1 hour'
      and not exists (
        select 1 from ops_sync_events a
        where a.company_id = e.company_id and a.event_type = ${ACK_TYPE}
          and (a.payload->>'alert_id')::bigint = e.id
          and a.created_at > now() - interval '1 hour'
      )`)[0].c;

  const leftovers = await sql`select count(*)::int c from ops_sync_events where payload::text like ${`%${MARK}%`}`;
  say("فاضل من جرياتي قبل دي", leftovers[0].c);
  const demoRows = await sql`select id, event_data->>'title' as title from agent_events`;
  say("سطور الجدول الميت اللي المفروض ما تظهرش", demoRows.length);
  const openBefore = await openCount();
  say("تنبيهات مفتوحة قبل القياس", openBefore);

  const [inserted] = await sql`
    insert into ops_sync_events (company_id, event_type, source_agent, target_agents, payload)
    values (${COMPANY}, 'tool:failed', 'ops-qa', '[]', ${{ summary: MARK }}::jsonb)
    returning id`;
  markId = Number(inserted.id);
  say("سطر القياس اتسجّل برقم", markId);

  const [shape] = await sql`select jsonb_typeof(payload) as t, payload->>'summary' as s from ops_sync_events where id = ${markId}`;
  say("شكل السطر في الدفتر", `${shape.t} · ${shape.s}`);
  check("سطر القياس اتخزّن ككائن مقروء مش نص", shape.t === "object" && shape.s === MARK);

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

  const readDoor = async (url) => page.evaluate(async (u) => {
    const res = await fetch(u, { cache: "no-store" });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, url);

  const strip = await readDoor("/api/admin/notifications?limit=20");
  const stripText = JSON.stringify(strip.body ?? {});
  say("باب التنبيهات ردّ بحالة", strip.status);
  check("الباب ردّ بنجاح", strip.body?.success === true);
  check("سطر القياس ظهر في التنبيهات", stripText.includes(MARK));
  check("العدّاد بيساوي السجل مضبوط بواحد", (strip.body?.data ?? []).length === openBefore + 1,
    `الباب قال ${(strip.body?.data ?? []).length} والسجل قال ${openBefore}`);
  check("الجدول الميت مفيهوش سطر طلع على الباب",
    demoRows.every((r) => !stripText.includes(`"id":"${r.id}"`) && !stripText.includes(String(r.title ?? "@@none@@"))),
    `سطور الجدول الميت: ${demoRows.length}`);
  const titles = (strip.body?.data ?? []).map((n) => n.title);
  check("كل عنوان بالعربي ومفيش مفتاح آلة",
    titles.length > 0 && titles.every((t) => /[\u0600-\u06FF]/.test(String(t))), titles.join(" | ").slice(0, 160));
  check("الباب ما بيوصلش درجة أهمية ما اتقستش",
    (strip.body?.data ?? []).every((n) => !("severity" in n)));

  const cockpit = await readDoor("/api/admin/agents/alerts");
  say("الشريط الأحمر ردّ بحالة", cockpit.status);
  check("الشاشتين عدّاه نفس العدد", cockpit.body?.count === (strip.body?.data ?? []).length,
    `الجديدة ${cockpit.body?.count} · القديمة ${(strip.body?.data ?? []).length}`);
  check("والشريط الأحمر شاف نفس السطر", Number(cockpit.body?.alert?.id) === markId,
    `قال ${cockpit.body?.alert?.id}`);
  const printed = (strip.body?.data ?? []).map((n) => `${n.title} ${n.message}`).join(" | ");
  check("الوصف اللي على الشاشتين عربي من غير مفتاح آلة",
    /[\u0600-\u06FF]/.test(String(cockpit.body?.alert?.note ?? "")) && !/[A-Za-z]/.test(printed),
    `الجديدة: ${cockpit.body?.alert?.label} — ${cockpit.body?.alert?.note}`.slice(0, 160));

  // His screen, with the alert live: the old landing's strip.
  let panelShown = false;
  for (let attempt = 1; attempt <= 6 && !panelShown; attempt++) {
    await page.goto(`${SITE}/admin`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(9000);
    const heading = page.getByText("الإشعارات", { exact: true }).first();
    panelShown = (await heading.count()) > 0;
    if (!panelShown) await new Promise((r) => setTimeout(r, 15000));
  }
  check("شاشة اللوحة القديمة فتحت وفيها الشريط", panelShown, page.url().replace(SITE, ""));
  errors.length = 0;

  const card = page.getByRole("heading", { name: "الإشعارات" })
    .locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
  const shot = await card.screenshot({ path: "scratch/alert-strip-live-390.png" }).then(() => true).catch(() => false);
  check("صورة الشريط والتنبيه الحيّ اتبّيتت", shot);
  const cardText = panelShown ? (await card.innerText().catch(() => "")) : "";
  check("سطر القياس مقروء على شاشة المالك", cardText.includes(MARK), cardText.replace(/\s+/g, " ").slice(0, 200));
  check("العدد على الشاشة بحروفه العربية", /[\u0660-\u0669]/.test(cardText) && !/[0-9]/.test(cardText.replace(/[\u0600-\u06FF]/g, "")),
    cardText.replace(/\s+/g, " ").slice(0, 120));

  const ack = await page.evaluate(async (ids) => {
    const res = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_ids: ids, action: "mark_read" }),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, [String(markId)]);
  say("الباب ردّ على التعليم كمقروء بحالة", ack.status);
  check("التعليم كمقروء نجح — ده اللي كان بيقف", ack.status === 200 && ack.body?.success === true,
    JSON.stringify(ack.body ?? {}).slice(0, 140));

  const receipts = await sql`
    select count(*)::int c from ops_sync_events
    where event_type = ${ACK_TYPE} and (payload->>'alert_id')::bigint = ${markId}::bigint`;
  ackRows = receipts[0].c;
  say("سجل الدفتر فيه وصلات مقروء للسطر ده", ackRows);
  check("الوصلة اتخزّنت فعلًا", ackRows === 1);

  const stripAfter = await readDoor("/api/admin/notifications?limit=20");
  const cockpitAfter = await readDoor("/api/admin/agents/alerts");
  const goneFromStrip = !JSON.stringify(stripAfter.body ?? {}).includes(MARK);
  check("سطر القياس اختفى من التنبيهات بعد التعليم", goneFromStrip);
  check("واختفى من الشريط الأحمر كمان", !JSON.stringify(cockpitAfter.body ?? {}).includes(MARK));
  check("العدّادين اتحدوا بعد التعليم", (stripAfter.body?.data ?? []).length === cockpitAfter.body?.count,
    `القديمة ${(stripAfter.body?.data ?? []).length} · الجديدة ${cockpitAfter.body?.count}`);
  const openAfter = (stripAfter.body?.data ?? []).length;
  check("التعليم مقفل سطري وبس، والباقي زي ما هو", openAfter === openBefore,
    `قبل ${openBefore} · بعد ${openAfter}`);
  const resting = stripAfter.body?.restingLine;
  if (openBefore === 0) {
    check("سطر السكون بيتقال لما مفيش حاجة مفتوحة", typeof resting === "string"
      && /[\u0600-\u06FF]/.test(resting) && /[\u0660-\u0669]/.test(resting) && !/[A-Za-z]/.test(resting), String(resting));
  } else {
    say("النافذة فيها تنبيهات تانية غير سطري — السكون مش متوقع", `قبل ${openBefore} · السطر الساكن: ${resting === null ? "مفيش" : "اتقال"}`);
  }

  await page.waitForTimeout(35000);
  const restShot = await card.screenshot({ path: "scratch/alert-strip-resting-390.png" }).then(() => true).catch(() => false);
  check("صورة السكون اتبّيتت", restShot);
  const restText = await card.innerText().catch(() => "");
  if (openBefore === 0) {
    check("الشريط على الشاشة قال السكون مش صفر مطمئن", restText.includes("مفيش تنبيه"),
      restText.replace(/\s+/g, " ").slice(0, 160));
  } else {
    check("الشريط على الشاشة ما بيورطش سطري بعد تعليمه", !restText.includes(MARK),
      restText.replace(/\s+/g, " ").slice(0, 160));
  }

  const anon = await chromium.launch({ headless: true });
  const anonCtx = await anon.newContext({ viewport: { width: 390, height: 900 } });
  const anonRes = await anonCtx.request.get(`${SITE}/api/admin/notifications?limit=20`);
  const anonBody = await anonRes.json().catch(() => null);
  say("زائر بلا جلسة ردّ بحالة", anonRes.status());
  check("الباب بيرفض على زائر بلا جلسة", anonRes.status() === 401, JSON.stringify(anonBody ?? {}).slice(0, 120));
  // The refusal is written by the outer gate in English; his screen never sees it because the
  // strip turns any non-Arabic door reply into one Arabic sentence (proved on the live card above).
  say("الرفض الخام من الطبقة الخارجية", JSON.stringify(anonBody ?? {}).slice(0, 90));
  await anon.close();

  const consoleMentions = errors.filter((e) => /notification/i.test(e));
  check("مفيش خطأ في الكونسول بسبب شريط التنبيهات", consoleMentions.length === 0, consoleMentions.join(" | ").slice(0, 200));
  say("كل أخطاء الكونسول على الشاشة القديمة", errors.length);

  await browser.close();
} catch (e) {
  check("الأداة مشت من غير استثناء", false, String(e && e.stack ? e.stack : e).replace(/\s+/g, " ").slice(0, 400));
} finally {
  if (markId) {
    await sql`delete from ops_sync_events where id = ${markId} and payload::text like ${`%${MARK}%`}`;
    await sql`delete from ops_sync_events where event_type = ${ACK_TYPE} and payload->>'alert_id' = ${String(markId)} and created_at >= ${runStart}::timestamptz`;
  }
  const residue = await sql`
    select count(*)::int c from ops_sync_events
    where payload::text like ${`%${MARK}%`} or (event_type = ${ACK_TYPE} and payload->>'alert_id' = ${String(markId ?? -1)})`;
  say("فاضل من سطري أنا بعد التنظيف", residue[0].c);
  const agentAfter = await sql`select count(*)::int c from agent_events`;
  say("سطور الجدول الميت زي ما كانت", agentAfter[0].c);
  await sql.end();
  const failed = checks.filter((c) => !c.ok);
  const summary = `${failed.length === 0 ? "ALL_PASS" : "SOME_FAIL"} — ${checks.length - failed.length}/${checks.length}`;
  lines.push(summary);
  console.log(summary);
  if (failed.length) console.log("FAILED_CHECKS=" + failed.map((f) => f.name).join(" || "));
  writeFileSync("scratch/prove-alert-strip.out", lines.join("\n") + "\n");
}
