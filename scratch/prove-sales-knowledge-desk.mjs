/**
 * prove-sales-knowledge-desk.mjs — the sales manager's memory, measured on his new desk.
 *
 * The transfer ledger said the new sales office could not reach the knowledge doors. This opens the
 * published page at 390px, teaches the manager a rule through the panel, reads it back from the
 * record, corrects it through the panel, asks the auditor, and then removes its own row by its own id
 * — an instrument that leaves a sentence in the owner's knowledge base is the defect this project has
 * already been burned by.
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
const MARK = "قياس آلي — قاعدة مؤقتة من محاجة الكابينة";
const MARK_EDITED = MARK + " (بعد التصحيح)";

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`);
};
const say = (label, value) => console.log(`${label}: ${value}`);

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
const countOf = async (text) => (await sql`select count(*)::int c from consultant_learnings where instruction = ${text}`)[0].c;
const before = (await sql`select count(*)::int c from consultant_learnings`)[0].c;
say("القواعد المسجلة قبل القياس", before);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const badResponses = [];
// Console errors caused by a deliberate refusal are classified here, by their own url, so the
// screen's clean-count below measures the screen and not my own button press.
const auditErrors = [];
page.on("console", (m) => {
  if (m.type() === "error" && String(m.location()?.url ?? "").includes("/api/admin/knowledge/audit")) auditErrors.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url().replace(BASE, "")}`);
});
await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(4000);
await page.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await page.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await page.click("button[type=submit]");
for (let i = 0; i < 25 && !page.url().includes("/admin"); i++) await page.waitForTimeout(2000);
check("دخل اللوحة", page.url().includes("/admin"), page.url().replace(BASE, ""));

// An in-flight fetch aborted by my own navigation logs «Failed to fetch» on the previous screen —
// that is my footstep, not the sales office's verdict, so the counter starts at this screen.
errors.length = 0;
await page.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(10000);
let body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
for (let attempt = 1; attempt <= 16 && !body.includes("معرفة مدير المبيعات"); attempt++) {
  console.log("النسخة المنشورة لسه ما فيهاش المكتب (" + attempt + ")");
  await new Promise((r) => setTimeout(r, 45000));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
}
check("مكتب المعرفة طالع على شاشة المالك", body.includes("معرفة مدير المبيعات"), body.slice(0, 60));

// The desk title was already live before this fix, so it cannot prove WHICH build the alias serves.
// The door's own answer does: the old build refused in Latin («Internal server error»), the new one
// refuses in his language. The probe waits for the published behaviour, not for a timestamp.
for (let attempt = 1; attempt <= 14; attempt++) {
  const spoken = await page.evaluate(async () => {
    try {
      const r = await fetch("/api/admin/knowledge/audit", { method: "POST" });
      const t = await r.text();
      return { status: r.status, arabic: /[؀-ۿ]/.test(t), head: t.slice(0, 90) };
    } catch (e) { return { status: null, arabic: false, head: String(e) }; }
  });
  if (spoken.arabic) { say("النسخة المنشورة بتتكلم العربي على باب التدقيق", `حالة ${spoken.status} · ${spoken.head}`); break; }
  console.log(`لسه النسخة القديمة على الرابط (محاولة ${attempt}): حالة ${spoken.status} · ${spoken.head}`);
  await new Promise((r) => setTimeout(r, 45000));
}
// The verdict below belongs to this screen alone: an aborted request from the landing page I passed
// through is my footstep, not the sales office's.
errors.length = 0;
badResponses.length = 0;
check("العناوين التلاتة موجودة", body.includes("القواعد اللي علّمتها له") && body.includes("أسئلة الزوار اللي لسه بلا رد") && body.includes("تدقيق المعرفة"), "");
check("الفرملة مكتوبة: مفيش زر مسح", body.includes("المسح مش في الأيد دي"), "");

const learningsNote = await page.evaluate(() => {
  const t = document.body.innerText;
  const m = t.match(/الباب ردّ بحالة [٠-٩]+|الاتصال بالباب فشل|قراءة .* فشلت/);
  return m ? m[0] : null;
});
say("لو كان فيه رفض من باب المعرفة", learningsNote ?? "مفيش رفض — الباب جاوب");

await page.fill("#knowledge-new", MARK);
await page.click("button:has-text('علّمه دي')");
for (let i = 0; i < 20 && !(await page.evaluate((m) => document.body.innerText.includes(m), MARK)); i++) await page.waitForTimeout(1500);
const shownInPanel = await page.evaluate((m) => document.body.innerText.includes(m), MARK);
check("القاعدة ظهرت في اللوحة بعد الحفظ", shownInPanel, "");
const afterAdd = (await sql`select count(*)::int c from consultant_learnings`)[0].c;
check("عدد القواعد في السجل زاد واحد", afterAdd === before + 1, `قبل=${before} بعد=${afterAdd}`);
const addedRow = await sql`select id from consultant_learnings where instruction = ${MARK} limit 1`;
const addedId = addedRow[0]?.id ?? null;
check("سطر المحاجة اتلاقى بكلمته في السجل", Boolean(addedId), addedId ?? "مفيش سطر");

if (addedId) {
  await page.click(`button:has-text('صحّح')`);
  await page.waitForTimeout(1500);
  await page.fill("#knowledge-edit", MARK_EDITED);
  await page.click("button:has-text('احفظ التصحيح')");
  for (let i = 0; i < 16 && !(await countOf(MARK_EDITED)); i++) await page.waitForTimeout(1500);
  check("التصحيح وصل للسجل", (await countOf(MARK_EDITED)) === 1, `عدد=${await countOf(MARK_EDITED)}`);
  check("النص القديم مش سايب مكانه", (await countOf(MARK)) === 0, `فاضل=${await countOf(MARK)}`);
}

// Before anything has run, the heading must carry no number at all — a zero here would read as
// «the shop is clean» about a hunt that never happened.
const resting = await page.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g, " ");
  return { chip: (t.match(/تدقيق المعرفة\s*([٠-٩]+)/) ?? [null, null])[1], resting: /لسه ما دورتش/.test(t) };
});
check("قبل أول تدوير مفيش عدد جنب العنوان", resting.chip === null, `العدد=${resting.chip ?? "مفيش"}`);
check("قبل أول تدوير الشاشة بتقول إنه لسه ما دوريش", resting.resting, "");

// The auditor is the third door. Either it answers with gaps or it refuses in words — both prove the
// desk reaches it; a silent button proves nothing.
const auditBtn = page.locator("button:has-text('دوّر على الفجوات')");
if (await auditBtn.count()) {
  // The door's own verdict, read off the wire: what the owner sees must be what the door answered,
  // and a refusal is allowed to be a 5xx as long as it arrives in his language.
  // The door's answer carries a model call inside it, and that call's length is not mine to guess:
  // the same door answered in 3 seconds once and in over 25 another time. So the probe waits on the
  // reply itself, with a long enough leash, and only then reads the screen.
  // Deliberate refusals from this door are classified by the listener installed at the top, so the
  // screen's own error count below is not polluted by a button I pressed on purpose.
  let wire = {};
  try {
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/admin/knowledge/audit"), { timeout: 240000 }),
      auditBtn.first().click({ force: true }),
    ]);
    wire = { status: res.status(), body: await res.text() };
  } catch (e) {
    wire = { status: null, body: null, error: String(e).slice(0, 120) };
  }
  // The panel needs one frame after the reply; poll for its sentence instead of sleeping.
  let auditState = null;
  for (let i = 0; i < 20 && !auditState; i++) {
    auditState = await page.evaluate(() => {
      const t = document.body.innerText.replace(/\s+/g, " ");
      const chip = t.match(/تدقيق المعرفة\s*([٠-٩]+)/);
      const s = {
        text: t,
        refused: /ردّ بحالة|التدقيق وقف|مفيش نموذج|ما وصلش أصلًا|انقطع|ما اتلمستش|ما تمّش|ما اتقراش/.test(t),
        latinLeak: /[A-Za-z]{4,}\s+[a-z]{3,}/.test(t.replace(/KnowledgeDesk|aria|placeholder/g, "")),
        empty: /دوّر وما لقاش فجوة|لسه ما دورتش/.test(t),
        gaps: chip ? chip[1] : null,
      };
      const settled = s.refused || s.empty || s.gaps !== null;
      return settled ? s : null;
    });
    if (!auditState) await page.waitForTimeout(2000);
  }
  if (!auditState) {
    auditState = await page.evaluate(() => {
      const t = document.body.innerText.replace(/\s+/g, " ");
      const chip = t.match(/تدقيق المعرفة\s*([٠-٩]+)/);
      return {
        text: t,
        refused: /ردّ بحالة|التدقيق وقف|مفيش نموذج|ما وصلش أصلًا|انقطع|ما اتلمستش|ما تمّش|ما اتقراش/.test(t),
        latinLeak: /[A-Za-z]{4,}\s+[a-z]{3,}/.test(t.replace(/KnowledgeDesk|aria|placeholder/g, "")),
        empty: /دوّر وما لقاش فجوة|لسه ما دورتش/.test(t),
        gaps: chip ? chip[1] : null,
      };
    });
  }
  say("الباب على السلك ردّ بالحالة", wire.status ?? "الباب ما اتناديش");
  say("الباب قال", (wire.body ?? "").slice(0, 160) || "(رد فاضي)");
  say("التدقيق رجع بإيه", auditState.refused ? "رفض مسموع بالعربي" : auditState.empty ? "مفيش فجوات" : `فجوات: ${auditState.gaps ?? "عدد غير مقروء"}`);
  // A loose check is a false green: the button must end in exactly one of three spoken states.
  check("زر التدقيق انتهى لحالة واحدة مسموعة", auditState.refused || auditState.empty || Boolean(auditState.gaps), JSON.stringify({ ...auditState, text: undefined }));
  check("مفيش جملة آلة لاتينية وصلت لشاشة المالك", !auditState.latinLeak, "");
  if (wire.status && wire.status >= 400) {
    const doorSentence = (() => { try { return JSON.parse(wire.body ?? "{}").error ?? null; } catch { return null; } })();
    check("الرفض من باب التدقيق مكتوب بالعربي على السلك", Boolean(doorSentence) && /[؀-ۿ]/.test(doorSentence), doorSentence?.slice(0, 80) ?? wire.body?.slice(0, 80) ?? "");
    check("اللوحة رجّعت جملة الباب نفسها، مش كلام آخر", Boolean(doorSentence) && String(auditState.text).includes(String(doorSentence)), doorSentence?.slice(0, 60) ?? "");
    // The count chip beside «تدقيق المعرفة» is the reassuring zero: it must not appear when nothing ran.
    check("الرفض ما رجعش عدد مختلق جنب العنوان", auditState.gaps === null, `العدد الظاهر=${auditState.gaps ?? "مفيش"}`);
  } else {
    check("الباب جاوب بالنجاح واللوحة عرضتوه", Boolean(auditState.gaps) || auditState.empty, JSON.stringify({ ...auditState, text: undefined }));
  }
  // Those resource errors belong to the deliberate refusal above; the screen's own count stays clean.
  say("رسائل المتصفح اللي سببها رفض التدقيق المتعمّد", auditErrors.length);
}

// One act, one rule: the desk used to write its own learning beside the door's compiled one, so a
// single answer taught the manager the same thing twice. This answers a question of the probe's own
// through the panel and counts what landed — then removes only the rows this block created.
const MARK_Q = "قياس آلي — سؤال مؤقت من محاجة الكابينة";
const MARK_A = "قياس آلي — رد مؤقت من محاجة الكابينة: المواعيد من تسعة للتمانية";
const seeded = await sql`
  insert into consultant_pending_questions (question, status)
  values (${MARK_Q}, 'pending') returning id`;
const seedId = seeded[0]?.id ?? null;
say("سطر السؤال المحاجة اتسجل", seedId ? "نعم" : "لأ");
if (seedId) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  const rowBtn = page.locator(`li:has-text('${MARK_Q}')`).locator("button:has-text('رد عليه')");
  check("سؤال المحاجة طلع في قائمة المنتظرة", (await rowBtn.count()) > 0, `عدد الأزرار=${await rowBtn.count()}`);
  if (await rowBtn.count()) {
    await rowBtn.first().click({ force: true });
    await page.waitForTimeout(1200);
    await page.fill("#question-answer", MARK_A);
    // The reply carries a model call inside it, so the panel's sentence can land long after the row
    // does. Waiting on the door's own response — not a wall clock — is the only honest trigger.
    const [doorReply] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/consultant/pending-questions") && r.request().method() === "PATCH", { timeout: 180000 }),
      page.click("button:has-text('علّمه الرد')"),
    ]);
    const replyBody = await doorReply.text();
    say("باب الرد ردّ بالحالة", doorReply.status());
    say("باب الرد قال", replyBody.slice(0, 180));
    let noteOnScreen = null;
    for (let i = 0; i < 20 && !noteOnScreen; i++) {
      noteOnScreen = await page.evaluate(() => {
        const t = document.body.innerText.replace(/\s+/g, " ");
        const m = t.match(/(بقى قاعدة عند مدير المبيعات[^.]*|القاعدة ما اتكوّنتش[^.]*|الردّ ما اتسجلش[^.]*)/);
        return m ? m[0] : null;
      });
      if (!noteOnScreen) await page.waitForTimeout(1500);
    }
    const compiledRows = await sql`
      select id, instruction from consultant_learnings
      where instruction like ${`%${MARK_Q}%`} order by created_at`;
    check("الرد علّم الدار مرة واحدة بس", compiledRows.length === 1, `عدد القواعد اللي فيها السؤال = ${compiledRows.length}`);
    const shapes = compiledRows.map((r) => (r.instruction.includes("-> إجابة") ? "door" : "desk"));
    check("القاعدة اللي اتكوّنت هي شكل الباب مش شكل المكتب", shapes.length === 1 && shapes[0] === "door", shapes.join("+") || "مفيش");
    const markedRow = await sql`select status, answered_reply from consultant_pending_questions where id = ${seedId}`;
    check("السؤال اتقاس عليه إنه اتحلّ في السجل", markedRow[0]?.status === "answered", `الحالة=${markedRow[0]?.status ?? "مفيش سطر"}`);
    check("الردّ نفسه وصل للسجل", String(markedRow[0]?.answered_reply ?? "") === MARK_A, (markedRow[0]?.answered_reply ?? "").slice(0, 40));
    say("لوحة المالك قالت عن التعلّم", noteOnScreen ?? "مفيش جملة مقروئة");
    check("اللوحة قالت حالة التعلّم بالكلام", Boolean(noteOnScreen), noteOnScreen ?? "صمت");
    // The probe's own rows go, matched by their own text and id; nothing of the owner's is touched.
    const goneLearnings = await sql`delete from consultant_learnings where instruction like ${`%${MARK_Q}%`} returning id`;
    say("قواعد المحاجة اللي اتمسحت", goneLearnings.length);
    check("مفيش قاعدة محاجة سايبة في معرفة الدار", goneLearnings.length === compiledRows.length, `ممسوح=${goneLearnings.length} من ${compiledRows.length}`);
  }
  const goneSeed = await sql`delete from consultant_pending_questions where id = ${seedId} returning id`;
  check("سطر السؤال المحاجة اتمسح بمعرّفه", goneSeed.length === 1, `ممسوح=${goneSeed.length}`);
}

// Cleanup: the instrument removes its own row by its own id, through the door the panel deliberately
// does not expose. Nothing of the owner's is touched.
if (addedId) {
  const gone = await sql`delete from consultant_learnings where id = ${addedId} returning id`;
  check("أثر المحاجة اتمسح بمعرّفه", gone.length === 1, `ممسوح=${gone.length}`);
}
const residue = (await sql`select count(*)::int c from consultant_learnings where instruction like 'قياس آلي%'`)[0].c;
const finalCount = (await sql`select count(*)::int c from consultant_learnings`)[0].c;
check("مفيش سطر محاجة سايب في معرفة الدار", residue === 0, `فاضل=${residue}`);
check("العدد رجع زي ما كان", finalCount === before, `قبل=${before} دلوقتي=${finalCount}`);

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1500);
await page.screenshot({ path: "scratch/sales-knowledge-desk-390.png" });
const screenErrors = errors.filter((e) => !auditErrors.includes(e));
check("صفر رسالة خطأ في المتصفح", screenErrors.length === 0, screenErrors.slice(0, 2).map((e) => e.slice(0, 90)).join(" | "));
say("الردود المخالفة على شاشة المبيعات", badResponses.length ? badResponses.join(" · ") : "مفيش");

await browser.close();
await sql.end();
const failed = checks.filter((c) => !c.ok);
console.log(`\nراجعت ${checks.length} · نجح ${checks.length - failed.length} · فشل ${failed.length}`);
for (const f of failed) console.log("فشل: " + f.name);
process.exit(failed.length ? 1 : 0);
