/**
 * prove-reply-drawn-not-printed.mjs — the assistant's reply on his screen, published link at 390px.
 *
 * Claims under attack: «the dock draws the emphasis instead of printing its markers», «the unified
 * assistant draws it too», «the drawing — not the door — is what took the asterisks off his screen»,
 * and «a collapsed preview still clamps a long answer».
 *
 * Measured before the fix: the renderer that turns «**bold**» into a bold word was written inside the
 * employees' chat panel file and never exported, so the assistant's own surfaces printed the asterisks.
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

const MARK = "بروفة الرسم";
const MSG = `تذكّر إن اللون المفضل: دهبي بروفة الرسم واحد`;

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

let browser = null;
let chatBefore = 0;

try {
  chatBefore = (await sql`select count(*)::int c from chat_history`)[0].c;
  const memBefore = (await sql`select count(*)::int c from agent_memory where category='admin_owner_memory'`)[0].c;
  say("قبل القياس", `سطور المحادثة ${chatBefore} · رفّ المالك ${memBefore}`);

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

  // ── the door still says it with markers (so the drawing is what changed, not the answer) ───
  await page.goto(`${SITE}/admin/owner-dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(5000);
  await page.click('button[title="المساعد الموحد"]');
  await page.waitForSelector('input[placeholder="اكتب للمساعد..."]', { timeout: 20000 });
  const wire = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/api/admin/assistant") && r.status() === 200,
    { timeout: 120000 },
  );
  await page.fill('input[placeholder="اكتب للمساعد..."]', MSG);
  await page.press('input[placeholder="اكتب للمساعد..."]', "Enter");

  const res = await wire;
  const body = await res.json().catch(() => null);
  const reply = String(body?.reply ?? "");
  check("الباب بعت الردّ وفيه نجوم فعلًا", reply.includes("**") && reply.includes("حفظت تفضيلك"),
    reply.slice(0, 90).replace(/\n/g, " | "));

  await page.waitForFunction(() => document.body.innerText.includes("حفظت تفضيلك"), { timeout: 90000 });
  const drawn = await page.evaluate(() => {
    const strongs = [...document.querySelectorAll('[data-emphasis="bold"]')].map((n) => n.textContent ?? "");
    const raw = [...document.querySelectorAll("p,div,span,li")]
      .filter((n) => n.children.length === 0 && /\*\*[^*]+\*\*/.test(n.textContent ?? ""))
      .map((n) => (n.textContent ?? "").slice(0, 60));
    return { strongs, raw, hasMark: document.body.innerText.includes("بروفة الرسم") };
  });
  check("الدرج رسم الكلمة الثقيلة بدل ما يطبع نجومها",
    drawn.strongs.some((t) => t.includes("حفظت تفضيلك")), JSON.stringify(drawn.strongs).slice(0, 120));
  check("مفيش كلمة منجمة بطبع حرفي على الشاشة", drawn.raw.length === 0 && drawn.hasMark,
    JSON.stringify(drawn.raw).slice(0, 140));
  await page.screenshot({ path: "scratch/reply-drawn-dock-390.png" });

  // ── the unified assistant page: same reply, same drawing ──────────────────────────────────
  await page.goto(`${SITE}/admin/agents?tab=assistant`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  const pageStars = await page.evaluate(() => ({
    raw: [...document.querySelectorAll("p,div,span,li")]
      .filter((n) => n.children.length === 0 && /\*\*[^*]+\*\*/.test(n.textContent ?? ""))
      .map((n) => (n.textContent ?? "").slice(0, 60)),
    strongs: [...document.querySelectorAll('[data-emphasis="bold"]')].map((n) => n.textContent ?? "").slice(0, 4),
    hasMark: document.body.innerText.includes("بروفة الرسم"),
  }));
  check("صفحة المساعد رجّعت التاريخ مرسوم من السجل",
    pageStars.hasMark && pageStars.strongs.some((t) => t.includes("حفظت تفضيلك")),
    JSON.stringify(pageStars.strongs).slice(0, 140));
  check("وصفحة المساعد كمان مفيش فيها كلمة منجمة مطبوعة", pageStars.raw.length === 0,
    JSON.stringify(pageStars.raw).slice(0, 140));
  await page.screenshot({ path: "scratch/reply-drawn-page-390.png" });

  say("أخطاء الكونسول في الجلسة", errors.length);
  check("مفيش أخطاء كونسول", errors.length === 0, errors.slice(0, 2).join(" | ").slice(0, 150));
} catch (e) {
  check("القياس اكتمل", false, String(e && e.message ? e.message : e));
} finally {
  try {
    const goneChat = await sql`delete from chat_history where content like ${like} returning id`;
    const goneMem = await sql`delete from agent_memory where content::text like ${like} returning id`;
    let goneExec = 0;
    try {
      const d = await sql`delete from agent_executions where execution_data::text like ${like} returning id`;
      goneExec = d.length;
    } catch { /* الجدول ده ممكن ما يكونش كتب */ }
    say("مسحت سطور القياس", `محادثة ${goneChat.length} · ذاكرة ${goneMem.length} · تنفيذ ${goneExec}`);

    const chatAfter = (await sql`select count(*)::int c from chat_history`)[0].c;
    const leftChat = (await sql`select count(*)::int c from chat_history where content like ${like}`)[0].c;
    const leftMem = (await sql`select count(*)::int c from agent_memory where content::text like ${like}`)[0].c;
    const leftExec = (await sql`select count(*)::int c from agent_executions where execution_data::text like ${like}`)[0].c;
    say("بعد التنضيف", `المحادثة ${chatAfter} · فاضل ${leftChat + leftMem + leftExec}`);
    check("مفيش سطر قياس فاضي في السجل", leftChat + leftMem + leftExec === 0, `فاضل ${leftChat + leftMem + leftExec}`);
    check("جدول المحادثة رجع لعدد قبل القياس", chatAfter === chatBefore, `قبل ${chatBefore} · بعد ${chatAfter}`);
  } catch (e) {
    check("التنضيف اكتمل", false, String(e && e.message ? e.message : e));
  }

  if (browser) await browser.close();
  await sql.end();
}

const passed = checks.filter((c) => c.ok).length;
const summary = `النتيجة: ${passed} نجح من ${checks.length}`;
lines.push(summary);
writeFileSync("scratch/prove-reply-drawn.out", lines.join("\n") + "\n");
console.log(summary);
process.exit(checks.length > 0 && passed === checks.length ? 0 : 1);
