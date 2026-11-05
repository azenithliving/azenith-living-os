/**
 * prove-chat-history-lands.mjs — the assistant's own conversation turns, on the published link at 390px.
 *
 * Claims under attack: «a turn the assistant answers gets stored», «the history the screen shows came
 * from the record», «the session id survives in the column the record has», and «a stranger reads
 * nothing and writes nothing».
 *
 * Measured before the fix: chat_history answers to 6 columns and held 0 rows — its writer sent
 * session_id, command_executed and command_result, which the record has never had, so every turn was
 * refused; and the history read asked for command_executed too, so the screen was blind on both ends.
 * Every row this instrument creates is deleted by its own marker text at the end.
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

const MARK = "بروفة المحادثة";
const MSG = `تذكّر إن المكتب المفضل: أوفيس بروفة المحادثة واحد`;

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
const myTurns = async () =>
  await sql`select id, user_id, role, content, metadata, created_at
            from chat_history where content like ${like} order by created_at`;
const totalRows = async () => (await sql`select count(*)::int c from chat_history`)[0].c;

let browser = null;
let totalBefore = 0;

try {
  totalBefore = await totalRows();
  say("قبل القياس", `مجموع سطور المحادثة ${totalBefore}`);
  check("الجدول كان فاضي من يومه", totalBefore === 0, `كان ${totalBefore}`);

  browser = await chromium.launch({ headless: true });
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

  const sent = await call("/api/admin/assistant", { method: "POST", body: JSON.stringify({ message: MSG }) });
  check("الباب ردّ على الكلمة", sent.status === 200 && sent.body?.success === true, `حالة ${sent.status}`);
  const reply = String(sent.body?.reply ?? sent.body?.message ?? "");
  check("الردّ قال إنه حفظ", reply.includes("حفظت تفضيلك"), reply.slice(0, 120).replace(/\n/g, " | "));

  let turns = await myTurns();
  say("سطور نزلت من كلمتي", `${turns.length} · أصوات ${turns.map((t) => t.role).join(",")}`);
  check("كلمتي وردّه اتسجّلوا في السجل", turns.length >= 2, `نازل ${turns.length}`);
  const mine = turns.filter((t) => t.role === "user");
  const theirs = turns.filter((t) => t.role === "assistant");
  check("المالك شاف كلمته في السجل", mine.length >= 1 && theirs.length >= 1,
    `هو ${mine.length} · هو ${theirs.length}`);
  check("الكلمة اتسجّلت باسم صاحبها", Boolean(mine[0]?.user_id), String(mine[0]?.user_id ?? "بلا صاحب").slice(0, 8));
  check("والجلسة عاشت في عمود التفاصيل اللي الجدول بيجاوبه",
    Boolean(mine[0]?.metadata?.session_id), JSON.stringify(mine[0]?.metadata ?? {}).slice(0, 120));

  const history = await call("/api/admin/assistant");
  const hist = Array.isArray(history.body?.history) ? history.body.history : [];
  const inHistory = hist.filter((h) => String(h.content ?? "").includes(MARK));
  check("الباب رجّع التاريخ من السجل", history.status === 200 && inHistory.length >= 2,
    `عدد المعروض ${hist.length} · فيهم علامتي ${inHistory.length}`);
  check("التاريخ مقروء فعلًا (مش سكوت)", history.body?.historyFailed === false,
    `قال ${JSON.stringify(history.body?.historyFailed)}`);
  check("وراجع بالترتيب الصح (الأقدم الأول)",
    inHistory.length >= 2 ? String(inHistory[0].content).includes("بروفة المحادثة واحد") === true : false,
    inHistory.map((h) => h.role).join(","));

  // ── the screen: the assistant page restores the turn from the record ─────────────────────
  await page.goto(`${SITE}/admin/agents?tab=assistant`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const shown = await page
    .waitForFunction((mark) => document.body.innerText.includes(mark), MARK, { timeout: 90000 })
    .then(() => true)
    .catch(() => false);
  check("الشاشة عرضت الكلمة القديمة من السجل بعد ما قفلت وفتحت", shown);
  await page.screenshot({ path: "scratch/chat-history-restored-390.png" });

  // ── the negative: a stranger reads nothing and writes nothing ────────────────────────────
  const anon = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const anonPage = await anon.newPage();
  await anonPage.goto(`${SITE}/admin/agents?tab=assistant`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const anonRead = await anonPage.evaluate(async () => {
    const res = await fetch("/api/admin/assistant", { cache: "no-store" });
    const body = await res.json().catch(() => null);
    return { status: res.status, count: Array.isArray(body?.history) ? body.history.length : -1 };
  });
  const turnsAfterAnon = await myTurns();
  say("قارئ بلا جلسة", `حالة ${anonRead.status}`);
  check("الباب رفض القارئ الغريب", anonRead.status === 401 || anonRead.status === 403, `حالة ${anonRead.status}`);
  check("والرفض ما كتبش سطر جديد", turnsAfterAnon.length === turns.length, `بقوا ${turnsAfterAnon.length}`);

  say("أخطاء الكونسول في الجلسة", errors.length);
  check("مفيش أخطاء كونسول في صفحة المساعد", errors.length === 0, errors.slice(0, 2).join(" | ").slice(0, 150));
} catch (e) {
  check("القياس اكتمل", false, String(e && e.message ? e.message : e));
} finally {
  try {
    const goneChat = await sql`delete from chat_history where content like ${like} returning id`;
    say("مسحت سطور المحادثة اللي عملتها", goneChat.length);

    let goneExec = 0;
    try {
      const d = await sql`delete from agent_executions where execution_data::text like ${like} returning id`;
      goneExec = d.length;
    } catch (e) { say("سجل التنفيذ", String(e && e.message ? e.message : e)); }
    say("مسحت سطور سجل التنفيذ اللي عملتها", goneExec);

    let goneMem = 0;
    try {
      const d = await sql`delete from agent_memory where content::text like ${like} returning id`;
      goneMem = d.length;
    } catch (e) { say("مخزن الذاكرة", String(e && e.message ? e.message : e)); }
    say("مسحت سطور الذاكرة اللي عملتها", goneMem);

    const leftChat = await myTurns();
    const totalAfter = await totalRows();
    const leftExec = (await sql`select count(*)::int c from agent_executions where execution_data::text like ${like}`)[0].c;
    const leftMem = (await sql`select count(*)::int c from agent_memory where content::text like ${like}`)[0].c;
    say("بعد التنضيف", `المحادثة ${totalAfter} · فاضل من علامتي ${leftChat.length} · فاضل في التنفيذ ${leftExec} · فاضل في الذاكرة ${leftMem}`);
    check("مفيش سطر قياس فاضي في السجل", leftChat.length === 0 && leftExec === 0 && leftMem === 0,
      `فاضل ${leftChat.length + leftExec + leftMem}`);
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
writeFileSync("scratch/prove-chat-history-lands.out", lines.join("\n") + "\n");
console.log(summary);
process.exit(checks.length > 0 && passed === checks.length ? 0 : 1);
