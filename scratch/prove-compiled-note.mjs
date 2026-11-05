/**
 * prove-compiled-note.mjs — why did the panel stay silent after the answer landed?
 *
 * Seeds a question of its own, answers it through the same door the panel calls, and prints the raw
 * body of the door's reply plus what the panel shows. The verdict belongs to the door's own words,
 * not to what the panel was expected to say.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const BASE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const Q = "قياس آلي — سؤال صامت من محاجة الباب";
const A = "قياس آلي — رد صامت من محاجة الباب";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const page = await ctx.newPage();
await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(4000);
await page.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await page.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await page.click("button[type=submit]");
for (let i = 0; i < 25 && !page.url().includes("/admin"); i++) await page.waitForTimeout(2000);
console.log("الدخول:", page.url().replace(BASE, ""));

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
const seeded = await sql`insert into consultant_pending_questions (question, status) values (${Q}, 'pending') returning id`;
const id = seeded[0].id;
console.log("سطر المحاجة:", id);

await page.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(12000);

// 1) The panel's own act, on a question that is still pending, waiting for the door's reply to
// arrive instead of a wall clock: the reply carries a model call, so it can land long after the row.
const seeded2 = await sql`insert into consultant_pending_questions (question, status) values (${Q + " — اللوحة"}, 'pending') returning id`;
const panelQ = Q + " — اللوحة";
const panelId = seeded2[0].id;
await page.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(12000);
const btn = page.locator(`li:has-text('${panelQ}')`).locator("button:has-text('رد عليه')");
console.log("زر الرد على السؤال في اللوحة:", await btn.count());
if (await btn.count()) {
  await btn.first().click({ force: true });
  await page.waitForTimeout(1500);
  await page.fill("#question-answer", A + " (من اللوحة)");
  const [doorReply] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/consultant/pending-questions"), { timeout: 180000 }),
    page.click("button:has-text('علّمه الرد')"),
  ]);
  const replyText = await doorReply.text();
  console.log("الباب ردّ على اللوحة بالحالة:", doorReply.status());
  console.log("الباب قال للوحة:", replyText.slice(0, 300));
  // The note is React state: it lands one frame after the reply, so wait for the sentence, not a timer.
  let note = null;
  for (let i = 0; i < 20 && !note; i++) {
    note = await page.evaluate(() => {
      const t = document.body.innerText.replace(/\s+/g, " ");
      const m = t.match(/(بقى قاعدة[^.]*|ما اتكوّنتش[^.]*|الردّ ما اتسجلش[^.]*)/);
      return m ? m[0] : null;
    });
    if (!note) await page.waitForTimeout(1500);
  }
  const allNotes = await page.evaluate(() => Array.from(document.querySelectorAll("p")).map((p) => p.innerText.trim()).filter((x) => x && x.length < 160).slice(0, 14));
  console.log("اللوحة قالت:", note ?? "(صمت)");
  console.log("جُمل اللوحة المقروءة:", JSON.stringify(allNotes));
  const panelRows = await sql`select id, instruction from consultant_learnings where instruction like ${`%${panelQ}%`}`;
  console.log("قواعد اللوحة:", panelRows.length, "| شكلها:", panelRows.map((r) => (r.instruction.includes("-> إجابة") ? "باب" : "مكتب")).join("+") || "-");
  const marked = await sql`select status from consultant_pending_questions where id = ${panelId}`;
  console.log("حالة السؤال في السجل:", marked[0]?.status ?? "مفيش سطر");
  const gonePanel = await sql`delete from consultant_learnings where instruction like ${`%${panelQ}%`} returning id`;
  const gonePanelQ = await sql`delete from consultant_pending_questions where id = ${panelId} or question = ${panelQ} returning id`;
  console.log("ممسوح من أثر اللوحة — قواعد:", gonePanel.length, "| أسئلة:", gonePanelQ.length);
}

// Cleanup: only the probe's own rows, matched by their own text and ids.
const goneLearn = await sql`delete from consultant_learnings where instruction like ${`%${Q}%`} returning id`;
const goneSeed = await sql`delete from consultant_pending_questions where id = ${id} returning id`;
const goneAny = await sql`delete from consultant_pending_questions where question = ${Q} returning id`;
console.log("ممسوح — قواعد:", goneLearn.length, "| سطر السؤال:", goneSeed.length + goneAny.length);
const residueQ = (await sql`select count(*)::int c from consultant_pending_questions where question like ${`%${Q}%`}`)[0].c;
const residueL = (await sql`select count(*)::int c from consultant_learnings where instruction like ${`%${Q}%`}`)[0].c;
console.log("فاضل من أثر المحاجة — أسئلة:", residueQ, "| قواعد:", residueL);

await browser.close();
await sql.end();
console.log("instrument exit marker printed");
