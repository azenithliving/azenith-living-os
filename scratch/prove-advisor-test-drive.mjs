/**
 * prove-advisor-test-drive.mjs — the advisor test-drive, measured on the published desk at 390px.
 *
 * The old screen never had this capability on any surface, so the proof is not «does the moved panel
 * still work» but «does the owner now see the door's real answer». The probe writes a question of its
 * own through the panel, compares the reply on the wire with the reply on the screen, and then removes
 * only the rows its own session id wrote.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const QUESTION = "قياس آلي — الصوفا بتوصل في قد إيه؟";

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`);
};
const say = (label, value) => console.log(`${label}: ${value}`);

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
const sessionsBefore = (await sql`select count(*)::int c from consultant_sessions`)[0].c;
say("محادثة في الدفتر قبل القياس", sessionsBefore);

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

await page.goto(`${SITE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(10000);
errors.length = 0;
let body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
for (let attempt = 1; attempt <= 16 && !body.includes("جرّب كلام المستشار"); attempt++) {
  console.log(`النسخة المنشورة لسه ما فيهاش التجربة (${attempt})`);
  await new Promise((r) => setTimeout(r, 45000));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
}
check("التجربة طالعة على مكتب المدير", body.includes("جرّب كلام المستشار"), body.slice(0, 70));
check("السطر بيقول إن السؤال بيتسجّل في الدفتر", body.includes("بيتسجّل كمحادثة في دفتر العملاء"), "");

const box = await page.evaluate(() => {
  const el = document.getElementById("advisor-test-input");
  if (!el) return null;
  el.scrollIntoView({ block: "center" });
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), right: Math.round(r.right), width: Math.round(r.width), inner: window.innerWidth };
});
check("مربّع الكتابة جوه الشاشة", Boolean(box) && box.x >= 0 && box.right <= box.inner, JSON.stringify(box));
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
say("الفضل العرضي خارج الشاشة", overflow);
check("مفيش زحافة أفقية على عرض ٣٩٠", overflow <= 1, `بكسل=${overflow}`);

const [doorRes] = await Promise.all([
  page.waitForResponse((r) => r.url().includes("/api/consultant") && r.request().method() === "POST", { timeout: 240000 }),
  (async () => {
    await page.fill("#advisor-test-input", QUESTION);
    await page.click("button:has-text('ابعت')");
  })(),
]);
const doorBody = await doorRes.json().catch(() => null);
const wireReply = String(doorBody?.reply ?? "");
const sessionId = String(doorBody?.sessionId ?? "");
say("الباب ردّ بالحالة", doorRes.status());
say("طول ردّ الباب", wireReply.length);
say("معرّف الجلسة اللي كتبت القياس", sessionId.slice(0, 22));

let onScreen = "";
for (let i = 0; i < 20 && !onScreen; i++) {
  onScreen = await page.evaluate((q) => {
    const t = document.body.innerText.replace(/\s+/g, " ");
    return t.includes("الردّ اللي هيوصل العميل") ? t.slice(t.indexOf(q)) : "";
  }, QUESTION);
  if (!onScreen) await page.waitForTimeout(1500);
}
check("سؤال القياس ظهر في المحادثة", (await page.evaluate(() => document.body.innerText)).includes(QUESTION), "");
check("الردّ المعروض هو ردّ الباب نفسه", wireReply.length > 0 && (await page.evaluate((r) => document.body.innerText.replace(/\s+/g, " ").includes(r.slice(0, 40)), wireReply)), wireReply.slice(0, 60));
// A test question must never become a rule: the door used to answer the owner's own desk with a
// learning confirmation because his signed-in session was taken as permission to teach.
check("سؤال التجربة ما اتسجّلش قاعدة في الحفظ", !wireReply.includes("القاعدة اتحفظت"), wireReply.slice(0, 60));
const planted = await sql`select id from consultant_learnings where instruction = ${QUESTION}`;
check("ولا سطر قاعدة زُرعت من التجربة", planted.length === 0, `سطور=${planted.length}`);
const screenText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
check("مفيش جملة محفوظة بتعدي مكان الردّ", !screenText.includes("تم استلام رسالتك"), "");
check("مفيش حرف لاتيني في سطر الرفض", !/الباب [^.]{0,80}[A-Za-z]{4,}/.test(screenText), "");

const written = await sql`select id from consultant_sessions where session_id = ${sessionId}`;
check("الباب فعلاً كتب محادثة في الدفتر (السطر تحتها بيصدق)", written.length > 0, `سطور=${written.length}`);

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1500);
await page.screenshot({ path: "scratch/advisor-test-drive-390.png" });
check("صفر رسالة خطأ في المتصفح", errors.length === 0, errors.slice(0, 2).map((e) => e.slice(0, 90)).join(" | "));

// Cleanup: only what this probe's own session id wrote.
const goneSessions = await sql`delete from consultant_sessions where session_id = ${sessionId} returning id`;
const goneQuestions = await sql`delete from consultant_pending_questions where session_id = ${sessionId} returning id`;
const sessionsAfter = (await sql`select count(*)::int c from consultant_sessions`)[0].c;
say("أثر القياس اللي اتمسح — محادثات", goneSessions.length);
say("أثر القياس اللي اتمسح — أسئلة معلّقة", goneQuestions.length);
check("مفيش أثر قياس سايب في الدفتر", sessionsAfter === sessionsBefore, `قبل=${sessionsBefore} بعد=${sessionsAfter}`);

await browser.close();
await sql.end();
const failed = checks.filter((c) => !c.ok);
console.log(`\nراجعت ${checks.length} · نجح ${checks.length - failed.length} · فشل ${failed.length}`);
for (const f of failed) console.log("فشل: " + f.name);
process.exit(failed.length ? 1 : 0);
