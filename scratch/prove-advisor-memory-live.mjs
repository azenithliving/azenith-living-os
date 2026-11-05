/**
 * prove-advisor-memory-live.mjs — the advisor answers a returning customer from the shop's memory.
 *
 * Three runs on the published site at 390px, through his own chat surface:
 *   A  he writes his taste and his number            → his facts must land under phone:<his digits>
 *   B  a NEW conversation, only his number          → the reply must open with «الدار فاكر» and name his taste
 *   C  a NEW conversation, a number nobody wrote     → no memory sentence, no rows
 * Every number this prints is read back from the record in the same run, and the rows it made are erased.
 */
import { chromium } from "playwright";
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();

const SITE = "https://azenith-living.vercel.app";
const HIS = "01199999901";
const STRANGER = "01199999902";
const KEY_HIS = "phone:1199999901";
const KEY_STRANGER = "phone:1199999902";

const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const say = (label, value) => console.log(`${label}: ${value}`);
const memoryRows = async (key) =>
  await sql`select kind, value, source, evidence, company_id from customer_memory where customer_key = ${key} order by kind`;

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`);
};

async function freshChat(context, text, { waitForSeconds = 90, screenshot = null } = {}) {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  // A clean slate: his chat keeps its session in localStorage, and a returning customer must be a
  // NEW session for this measurement to mean anything.
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const panel = page.locator('input[placeholder="اكتب رسالتك..."]');
  if (!(await panel.count())) {
    // The advisor's avatar floats (motion animates it forever), so Playwright's stability check never
    // settles. Hand the click to the element itself — the same handler a finger would fire.
    await page.locator("[data-chat-open]").evaluate((el) => el.click());
    for (let waited = 0; !(await panel.count()) && waited < 20; waited += 2) await page.waitForTimeout(2000);
  }
  if (!(await panel.count())) throw new Error("the customer's chat input never opened");

  await panel.fill(text);
  // The panel already carries a scripted greeting before he types, so counting bubbles from zero
  // would read the greeting as his answer. Count what is there NOW, and wait for one more.
  const bubbles = page.locator('[data-chat-bubble="assistant"]');
  const before = await bubbles.count();
  const greeted = before > 0 ? (await bubbles.allInnerTexts()).at(-1) : "";
  await page.locator('button[type="submit"]').click();

  const deadline = Date.now() + waitForSeconds * 1000;
  while (Date.now() < deadline) {
    if ((await bubbles.count()) > before) break;
    await page.waitForTimeout(1000);
  }
  const replies = await bubbles.allInnerTexts();
  const reply = replies.length > before ? replies.at(-1) : "";
  const sessionId = await page.evaluate(() => localStorage.getItem("azenith_session_id"));
  if (screenshot) await page.screenshot({ path: screenshot });
  await page.close();
  return { errors, replies, reply, greeted, sessionId };
}

const context = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "ar-EG",
};

const browser = await chromium.launch();
const ctx = await browser.newContext(context);

// A deferred write from an earlier run can land after that run's own cleanup — so the first thing
// this measurement does is clear ITS TWO KEYS, and only then count what the store holds.
await sql`delete from customer_memory where customer_key in (${KEY_HIS}, ${KEY_STRANGER})`;
const beforeTotal = (await sql`select count(*)::int as c from customer_memory where customer_key in (${KEY_HIS}, ${KEY_STRANGER})`)[0].c;
say("سطور الذاكرة تحت رقمتي القياس قبل ما يبدأ", beforeTotal);

// ── A · he names his taste and his number ─────────────────────────────────
const a = await freshChat(ctx, `أنا كريم، عايز غرف المعيشة بالطراز المودرن ومنطقتي التجمع، رقمي ${HIS}`);
say("رد الدار على ورقته الأولى (90 حرف)", (a.reply || "—").slice(0, 90).replace(/\s+/g, " "));
check("أول معرفته ما بيتقالش عليها ذاكرة", !!a.reply && !a.reply.includes("الدار فاكر"), (a.reply || "مفيش رد جديد").slice(0, 40));

let hisRows = await memoryRows(KEY_HIS);
for (let waited = 0; hisRows.length === 0 && waited < 25; waited += 5) {
  await new Promise((r) => setTimeout(r, 5000));
  hisRows = await memoryRows(KEY_HIS);
}
if (hisRows.length === 0) {
  // Zero rows is most often the OLD build still being served, not a broken feature — the same trap
  // as reading a 404 on a table that has not been reloaded. Say it in those words.
  console.log("تحذير: صفر سطور بعد 25 ثانية — النسخة المنشورة لسه ما اتحدّثتش أو الكتابة اترفضت");
}
check("كلامه مع المسترشد اتحوّل ذاكرة تحت رقمه", hisRows.length >= 2, `سطور=${hisRows.length}`);
check("كل سطر يعرف منين جه", hisRows.every((r) => String(r.source || "").includes("المسترشد")), hisRows.map((r) => r.kind).join(","));
check(
  "طرازها ومحله اتسجلوا بأسمائهم العربية",
  hisRows.some((r) => r.kind === "style") && hisRows.some((r) => r.kind === "area") && hisRows.some((r) => r.kind === "room"),
  hisRows.map((r) => `${r.kind}=${r.value}`).join(" · ")
);
const companyOfFacts = hisRows[0]?.company_id ?? null;
const realCompany = (await sql`select id, name, domain from companies order by created_at asc limit 2`);
check(
  "الذاكرة اتحطت تحت الشركة الصح مش تحت حجة فارغة",
  !!companyOfFacts && realCompany.some((c) => c.id === companyOfFacts),
  companyOfFacts ?? "مفيش سطر"
);

// ── B · a NEW conversation, his number only ───────────────────────────────
const b = await freshChat(ctx, `رقمي ${HIS}`, { screenshot: "scratch/advisor-remembers-him-390.png" });
const remembered = b.reply;
say("رد الدار عليه في المحادثة الجديدة", remembered.slice(0, 140).replace(/\s+/g, " "));
check("المسترشد افتكره من أول جملة", remembered.includes("الدار فاكر"), remembered.slice(0, 40));
check("قال له اللي فاكره بالعربي", remembered.includes("مودرن") || remembered.includes("التجمع") || remembered.includes("المعيشة"), remembered.slice(0, 80));
check("مفيش كلمة إنچليزية في ردّه", !/[A-Za-z]{3,}/.test(remembered.replace(/https?:\/\/\S+/g, "")), remembered.slice(0, 60));

// ── C · a stranger's number ───────────────────────────────────────────────
const c = await freshChat(ctx, `رقمي ${STRANGER}`);
const strangerReply = c.reply;
say("رد الدار على رقم ما سجلش قبل كده", strangerReply.slice(0, 100).replace(/\s+/g, " "));
check("اللي مفيش عنه حاجة ما بيتقالش إنه متفتح", !strangerReply.includes("الدار فاكر"), strangerReply.slice(0, 40));
const strangerRows = await memoryRows(KEY_STRANGER);
check("رقم الغريب ما اتكتبش في الذاكرة", strangerRows.length === 0, `سطور=${strangerRows.length}`);

const consoleErrors = [...a.errors, ...b.errors, ...c.errors].filter((e) => !/favicon|404|net::ERR_BLOCKED|Download the React/i.test(e));
check("مفيش أخطاء متصفح في الشات", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

// ── the instrument's own rows, erased ─────────────────────────────────────
const sessions = [a.sessionId, b.sessionId, c.sessionId].filter(Boolean);
await sql`delete from customer_memory where customer_key in (${KEY_HIS}, ${KEY_STRANGER})`;
for (const s of sessions) {
  // One session at a time, by its own id: nothing here is a blanket delete.
  await sql`delete from consultant_sessions where session_id = ${s}`;
  await sql`delete from lead_conversions where session_id = ${s}`;
  await sql`delete from users where session_id = ${s}`;
}
// The door writes his facts after it answers, so a cleanup that runs the second the reply lands can
// be followed by the write it just erased. Let the deferred work finish, sweep again, then count.
await new Promise((r) => setTimeout(r, 25000));
await sql`delete from customer_memory where customer_key in (${KEY_HIS}, ${KEY_STRANGER})`;
const afterRows = (await sql`select count(*)::int as c from customer_memory`)[0].c;
// A conversation outlives the tab it started in: the browser mints its own id before the first send,
// so the localStorage copy can name a session the door never stored. Sweep by HIS number too, and
// print what each sweep removed — a cleanup nobody counted is a claim, not a measurement.
const byNumber = await sql`delete from consultant_sessions where messages::text like ${"%" + HIS + "%"} or messages::text like ${"%" + STRANGER + "%"} returning session_id`;
say("جلسات امسحتها على رقمه", byNumber.length);
let stillMine = 0;
for (const s of sessions) stillMine += (await sql`select count(*)::int as c from consultant_sessions where session_id = ${s}`)[0].c;
stillMine += (await sql`select count(*)::int as c from consultant_sessions where messages::text like ${"%" + HIS + "%"}`)[0].c;
say("جلسات المحاجة اللي سيبتها", stillMine);
say("سطور الذاكرة في المتجر بعد التنضيف", afterRows);
const mineAfter = (await sql`select count(*)::int as c from customer_memory where customer_key in (${KEY_HIS}, ${KEY_STRANGER})`)[0].c;
say("سطور الذاكرة في المتجر كله بعد التنضيف", afterRows);
check("مفيش سطر تحت رقم Measurement", mineAfter === 0, `تحت رقمتي القياس = ${mineAfter}`);

await ctx.close();
await browser.close();
await sql.end();

const failed = checks.filter((k) => !k.ok);
console.log(`\nراجعت ${checks.length} · نجح ${checks.length - failed.length} · فشل ${failed.length}`);
for (const f of failed) console.log(`فشل: ${f.name} · ${f.detail}`);
process.exit(failed.length ? 1 : 0);
