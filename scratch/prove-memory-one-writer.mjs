/**
 * prove-memory-one-writer.mjs — the employees' memory table, measured on the published link at 390px.
 *
 * Claims under attack: «a memory row the store writes actually lands», «the assistant only promises
 * what the record stored», «the owner's shelf reads back what it wrote», «a stranger cannot write
 * into it», and «the relation health door stops blaming a schema it never read».
 *
 * Measured before the fix: agent_memory answers to 13 columns, all six of its writers sent names
 * the record has never had (company, actor, source), all six skipped the required kind column, and
 * every one of the 8 stored rows carried the record's own default category — no desk had ever
 * written a row. The health door meanwhile called all four of its tables missing on every column,
 * because PostgREST cannot serve the system view it was asking.
 *
 * Every row this instrument creates is deleted by its own marker text at the end, and the leftover
 * count is printed before any claim is made.
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

const MARK = "بروفة الذاكرة";
const M1 = "تذكّر إن الوسادة المفضلة: كتان بروفة الذاكرة واحد";
const M2 = "تذكّر إن المقاس المفضل: كبير بروفة الذاكرة اتنين";
const EXPECTED_COLUMNS = [
  "memory_type", "type", "category", "content", "context",
  "user_id", "priority", "outcome", "user_feedback", "expires_at",
];

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
const like = `%${MARK}%`;
const shelfCount = async () =>
  (await sql`select count(*)::int c from agent_memory where category = 'admin_owner_memory'`)[0].c;
const totalCount = async () => (await sql`select count(*)::int c from agent_memory`)[0].c;
const markerRows = async () =>
  await sql`select id, memory_type, type, category, priority, user_id, content::text as text
            from agent_memory where content::text like ${like} order by created_at`;

let browser = null;
let ctx = null;
let totalBefore = 0;
let chatBefore = 0;

try {
  totalBefore = await totalCount();
  chatBefore = (await sql`select count(*)::int c from chat_history`)[0].c;
  const shelfBefore = await shelfCount();
  say("قبل القياس", `مجموع سطور الذاكرة ${totalBefore} · رفّ المالك ${shelfBefore} · سطور الشات ${chatBefore}`);
  check("رفّ المالك كان فاضي قبل الإصلاح", shelfBefore === 0, `كان ${shelfBefore}`);

  browser = await chromium.launch({ headless: true });
  ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
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
  await page.waitForTimeout(5000);

  // ── the surface: the owner's own assistant dock, typed by hand ──────────────────────────
  await page.click('button[title="المساعد الموحد"]');
  await page.waitForSelector('input[placeholder="اكتب للمساعد..."]', { timeout: 20000 });
  await page.fill('input[placeholder="اكتب للمساعد..."]', M1);
  await page.press('input[placeholder="اكتب للمساعد..."]', "Enter");

  const promised = await page
    .waitForFunction(() => document.body.innerText.includes("حفظت تفضيلك"), { timeout: 90000 })
    .then(() => true)
    .catch(() => false);
  check("المالك شاف على شاشته إن التفضيل اتحفظ", promised);

  let mine = await markerRows();
  say("سطور نزولتي من الباب الأول", mine.length);
  check("سطر الذاكرة نزل فعلاً في السجل", mine.length === 1, `نازل ${mine.length}`);
  const r1 = mine[0];
  check("بنوع الذاكرة في العمودين اللي الجدول بيجاوبهم", r1?.memory_type === "preference" && r1?.type === "preference",
    `قالوا ${r1?.memory_type ?? "-"} و ${r1?.type ?? "-"}`);
  check("على رفّ المالك نفسه", r1?.category === "admin_owner_memory", `قال ${r1?.category ?? "-"}`);
  check("بأولوية عالية مش بكلمة مختلعة", r1?.priority === "high", `قال ${r1?.priority ?? "-"}`);
  check("وبلا عمود صاحب، لأن عمود الشخص في الجدول بيشاور على كشف العملاء", r1?.user_id === null,
    `قال ${r1?.user_id ?? "فااضي"}`);
  check("المحتول اتسجّل زي ما اتقال", Boolean(r1?.text?.includes("كتان")), String(r1?.text ?? "").slice(0, 70));
  check("الكلمة اللي قالها الباب هي الكلمة اللي في السجل", r1?.text?.includes("الوسادة المفضلة=كتان"),
    String(r1?.text ?? "").slice(0, 70));

  await page.screenshot({ path: "scratch/memory-landed-390.png" });

  const call = (url, init) => page.evaluate(async ([u, i]) => {
    const res = await fetch(u, { ...i, headers: { "Content-Type": "application/json", ...(i && i.headers ? i.headers : {}) } });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, [url, init ?? {}]);

  // ── the reader: the second ask must repeat what the first one stored ──────────────────────
  const second = await call("/api/admin/assistant", { method: "POST", body: JSON.stringify({ message: M2 }) });
  const reply2 = String(second.body?.reply ?? "");
  check("الباب التانى ردّ بحالة", second.status === 200 && second.body?.success === true, `حالة ${second.status}`);
  check("المساعد رجّع تفضيل المالك الأول من السجل", reply2.includes("تفضيلات المالك المحفوظة") && reply2.includes("كتان"),
    reply2.slice(0, 150).replace(/\n/g, " | "));

  mine = await markerRows();
  check("البابين نزّلوا سطرين على الرفّ", mine.length === 2, `عدد الرفّ ${mine.length}`);

  // ── the health door: the right list, and no invented gap ─────────────────────────────────
  const health = await call("/api/admin/intel/relations/health", { headers: { "x-admin-user-id": "probe" } });
  const memCheck = (health.body?.data?.checks ?? []).find((c) => c.table === "agent_memory");
  check("باب الفحص بيسأل عن الأعمدة اللي الكتابة بتستخدمها",
    JSON.stringify([...(memCheck?.requiredColumns ?? [])].sort()) === JSON.stringify([...EXPECTED_COLUMNS].sort()),
    JSON.stringify(memCheck?.requiredColumns ?? []).slice(0, 140));
  check("وبيقول ما قراش، مش إن الجدول بايظ",
    health.status === 200 && memCheck?.readFailed === true && memCheck?.missingColumns?.length === 0,
    `قرأ؟ ${memCheck?.readFailed} · ناقص ${JSON.stringify(memCheck?.missingColumns ?? [])}`);
  check("وبيسمّي العمى في رده", String(health.body?.message ?? "").includes("Schema read unavailable"),
    String(health.body?.message ?? "").slice(0, 120));
  check("وبرضه بيسمّي الناقص الحقيقي لو قرا", !String(health.body?.meta?.migrationHint ?? "").includes("030_intel_relations"),
    String(health.body?.meta?.migrationHint ?? "").slice(0, 120));

  // ── the negative: a stranger cannot write memory through the door ────────────────────────
  const anon = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const anonPage = await anon.newPage();
  await anonPage.goto(`${SITE}/admin/owner-dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const anonReply = await anonPage.evaluate(async (m) => {
    const res = await fetch("/api/admin/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: m }),
    });
    return { status: res.status };
  }, M2);
  const markerAfterAnon = await markerRows();
  say("الغريب طلب بنفس الرسالة", `حالة ${anonReply.status}`);
  check("الباب رفض الغريب", anonReply.status === 401 || anonReply.status === 403, `حالة ${anonReply.status}`);
  check("والرفض ما كتّبش سطر جديد", markerAfterAnon.length === 2, `سطور العلامة ${markerAfterAnon.length}`);

  const chatNow = (await sql`select count(*)::int c from chat_history`)[0].c;
  say("سطور الشات بعد القياس", `${chatBefore} → ${chatNow}`);
  check("مفيش سطر شات جديد، لأن الكتابة في جدول الشات ميتة أصلاً", chatNow === chatBefore, `بقوا ${chatNow}`);

  const pageErrors = errors.length;
  say("أخطاء الكونسول في الجلسة", pageErrors);
  check("مفيش أخطاء كونسول في صفحة المالك", pageErrors === 0, errors.slice(0, 2).join(" | ").slice(0, 150));
} catch (e) {
  check("القياس اكتمل", false, String(e && e.message ? e.message : e));
} finally {
  try {
    const gone = await sql`delete from agent_memory where content::text like ${like} returning id`;
    say("مسحت سطور الذاكرة اللي عملتها", gone.length);

    const execGone = await sql`
      delete from agent_executions where execution_data::text like ${like} returning id`;
    say("مسحت سطور سجل التنفيذ اللي عملتها", execGone.length);

    const leftovers = await markerRows();
    const totalAfter = await totalCount();
    const execLeft = (await sql`select count(*)::int c from agent_executions where execution_data::text like ${like}`)[0].c;
    say("بعد التنضيف", `مجموع سطور الذاكرة ${totalAfter} · فاضل من علامتي ${leftovers.length} · فاضل في السجل ${execLeft}`);
    check("مفيش سطر قياس فاضي في السجل", leftovers.length === 0 && execLeft === 0, `فاضل ${leftovers.length + execLeft}`);
    check("الجدول رجع لنفس العدد قبل القياس", totalAfter === totalBefore, `قبل ${totalBefore} · بعد ${totalAfter}`);
  } catch (e) {
    check("التنضيف اكتمل", false, String(e && e.message ? e.message : e));
  }

  if (browser) await browser.close();
  await sql.end();
}

const passed = checks.filter((c) => c.ok).length;
const summary = `النتيجة: ${passed} نجح من ${checks.length}`;
lines.push(summary);
writeFileSync("scratch/prove-memory-one-writer.out", lines.join("\n") + "\n");
console.log(summary);
process.exit(checks.length > 0 && passed === checks.length ? 0 : 1);
