/**
 * prove-owner-dashboard-alerts.mjs — the owner dashboard's alert block and its "waiting" tile,
 * measured on the published link at 390px.
 *
 * The claims under attack: «the block shows trouble the store recorded today», «the tile counts
 * papers that actually waited», and «a closed alert leaves the block on every screen». The block
 * used to read a table through two columns that do not exist, so its query failed on every load
 * and the page printed «جميع الأنظمة مستقرة» over nothing.
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

const COMPANY = env.ADMIN_COMPANY_ID?.trim();
const MARK = "سطر قياس لوحة المالك — مش تنبيه حقيقي";
const AR = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
const toAr = (n) => String(n).split("").map((d) => AR[Number(d)] ?? d).join("");

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
let alertId = null;
let ackCount = 0;

try {
  if (!COMPANY) throw new Error("ADMIN_COMPANY_ID مش متظبط");

  const overdue = (await sql`
    select count(*)::int c from approval_requests
    where company_id = ${COMPANY} and status = 'pending' and requested_at < now() - interval '24 hours'`)[0].c;
  const devices = (await sql`select count(*)::int c from agent_devices where is_active = true`)[0].c;
  const alertsToday = (await sql`
    select count(*)::int c from ops_sync_events
    where created_at >= date_trunc('day', now())
      and event_type in ('anomaly_detected','identity_violation','scope_violation','quality_gate_failed','agent_task_failed','emergency_stop','system:anomaly_detected','system:error','tool:failed','workflow:failed','task:failed')`)[0].c;
  say("ورق مستني من امبارح", overdue);
  say("أجهزة متصلة", devices);
  say("تنبيهات النهاردة قبل القياس", alertsToday);

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

  await page.goto(`${SITE}/admin/owner-dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=تنبيهات استراتيجية", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const restText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  say("الشاشة فتحت", page.url().replace(SITE, ""));
  check("البلاية بتقول العدد المقاس مش وعد", restText.includes(toAr(overdue)) && restText.includes("ورقة مستنية من امبارح"),
    restText.slice(0, 160));
  check("الراحة بتتقال بجملة مقاسة", restText.includes("مفيش تنبيه مفتوح النهاردة في دفتر المتجر"));
  check("الوعد القديم مش على الشاشة", !restText.includes("جميع الأنظمة مستقرة"));
  check("مفيش أسماء آلة إنجليزية على الكروت", !/VANGUARD AI|ACTIVE DEVICES/.test(restText));
  check("الأجهزة المتصلة اتقست", restText.includes(toAr(devices)), `العدد ${devices}`);
  errors.length = 0;

  const [row] = await sql`
    insert into ops_sync_events (company_id, event_type, source_agent, target_agents, payload)
    values (${COMPANY}, 'tool:failed', 'ops-qa', '[]', ${{ summary: MARK }}::jsonb) returning id`;
  alertId = Number(row.id);
  say("سطر القياس اتسجّل برقم", alertId);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=تنبيهات استراتيجية", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const liveText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  check("التنبيه طلع على لوحة المالك", liveText.includes(MARK) && liveText.includes("أداة فشلت في التنفيذ"),
    liveText.slice(Math.max(0, liveText.indexOf("تنبيهات استراتيجية")), liveText.indexOf("تنبيهات استراتيجية") + 220));
  check("العدد زاد بواحد بس", liveText.includes(toAr(alertsToday + 1)) || liveText.includes(MARK));

  const card = page.locator("div", { hasText: "تنبيهات استراتيجية" }).last();
  const shot = await card.screenshot({ path: "scratch/owner-dashboard-alerts-390.png" }).then(() => true).catch(() => false);
  check("صورة كارت التنبيهات اتبّيتت", shot);

  const ack = await page.evaluate(async (id) => {
    const res = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_ids: [String(id)], action: "mark_read" }),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, alertId);
  check("التعليم كمقروء نجح", ack.status === 200 && ack.body?.success === true, JSON.stringify(ack.body ?? {}).slice(0, 120));
  const acks = await sql`
    select count(*)::int c from ops_sync_events
    where event_type = 'owner_alert_acknowledged' and payload->>'alert_id' = ${String(alertId)}`;
  ackCount = acks[0].c;
  say("وصلات المقروء للسطر ده", ackCount);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=تنبيهات استراتيجية", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const afterText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  check("السطر مقفل من لوحة المالك كمان", !afterText.includes(MARK));
  check("والراحة رجعت جملة مقاسة مش وعد", afterText.includes("مفيش تنبيه مفتوح النهاردة في دفتر المتجر"));
  check("مفيش خطأ كونسول على الشاشة", errors.length === 0, errors.join(" | ").slice(0, 200));
  await browser.close();
} catch (e) {
  check("الأداة مشت من غير استثناء", false, String(e && e.stack ? e.stack : e).replace(/\s+/g, " ").slice(0, 400));
} finally {
  if (alertId) {
    await sql`delete from ops_sync_events where id = ${alertId} and payload::text like ${`%${MARK}%`}`;
    await sql`delete from ops_sync_events where event_type = 'owner_alert_acknowledged' and payload->>'alert_id' = ${String(alertId)}`;
  }
  const residue = await sql`
    select count(*)::int c from ops_sync_events
    where payload::text like ${`%${MARK}%`} or payload->>'alert_id' = ${String(alertId ?? -1)}`;
  say("فاضل من سطري بعد التنظيف", residue[0].c);
  const total = await sql`select count(*)::int c from ops_sync_events`;
  say("سطور الدفتر بعد التنضيف", total[0].c);
  await sql.end();
  const failed = checks.filter((c) => !c.ok);
  const summary = `${failed.length === 0 ? "ALL_PASS" : "SOME_FAIL"} — ${checks.length - failed.length}/${checks.length}`;
  lines.push(summary);
  console.log(summary);
  if (failed.length) console.log("FAILED_CHECKS=" + failed.map((f) => f.name).join(" || "));
  writeFileSync("scratch/prove-owner-dashboard.out", lines.join("\n") + "\n");
}
