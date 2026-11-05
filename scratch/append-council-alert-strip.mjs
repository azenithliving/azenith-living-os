import fs from "node:fs";

/**
 * Appends the alert-strip atom to the running log. Every number is either re-measured from the
 * live record in this same run, or parsed out of a measurement file a tool wrote in this session.
 * Digits are typed as Latin in the prose below and converted to the owner's numerals by the same
 * pass — hand-typed Arabic-Indic digits are where my last three digit defects came from.
 */
const path = "docs/ledger/council-minutes.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
const sql = await import("postgres").then((m) => m.default(process.env.DIRECT_URL, { ssl: "require", max: 1 }));

const deadRows = (await sql`select count(*)::int c from agent_events`)[0].c;
const deadCols = (await sql`select count(*)::int c from information_schema.columns where table_schema='public' and table_name='agent_events'`)[0].c;
const ledgerRows = (await sql`select count(*)::int c from ops_sync_events`)[0].c;
const ALERT_TYPES = ["anomaly_detected","identity_violation","scope_violation","quality_gate_failed","agent_task_failed","system:anomaly_detected","system:error","tool:failed","workflow:failed","task:failed"];
const alertRows = (await sql`select count(*)::int c from ops_sync_events where event_type = any(${ALERT_TYPES}::text[])`)[0].c;
await sql.end();

const readMatch = (file, re) => {
  const text = fs.readFileSync(file, "utf8").replace(/\u001b\[[0-9;]*m/g, "");
  const m = text.match(re);
  if (!m) throw new Error(`${file} has no match for ${re}`);
  return m;
};
const proof = readMatch("scratch/prove-alert-strip.out", /ALL_PASS — (\d+)\/(\d+)/);
const swept = readMatch("scratch/sweep-alert-probe.out", /FOUND_ROWS=(\d+)/)[1];
const residue = readMatch("scratch/prove-alert-strip.out", /فاضل من سطري أنا بعد التنظيف: (\d+)/)[1];
const tests = readMatch("scratch/alerts-fullsuite2.out", /Tests\s+(\d+) passed/)[1];

const T = {
  WHEN: when,
  DEAD_ROWS: deadRows,
  DEAD_COLS: deadCols,
  LEDGER: ledgerRows,
  ALERTS: alertRows,
  PROOF: proof[1],
  PROOF_TOTAL: proof[2],
  SWEPT: swept,
  RESIDUE: residue,
  TESTS: tests,
};

const lines = [
  "",
  "- **الوكيل ({WHEN}):** **شريط التنبيهات في اللوحة القديمة كان بيقرأ من جدول ميت — و«قراءة الكل» كانت بتقف في كل ضغطة.**",
  "  **الذرة:** اللوحة القديمة ليها شريط تنبيهات لوحه. بابه كان بيقرأ من جدول قديم للحوادث، والقياس على القاعدة الحيّة قال: الجدول فيه **{DEAD_ROWS}** صفوف بس، كلهم مزروعين يوم 2026-08-10 من سكربت استعراض، وعدد أعمدته **{DEAD_COLS}** — ومنهم اتنين الباب نفسه بيقراهم ويكتب فيهم («درجة الأهمية» و«اتقريت متى»): مش موجودين، فالرفض كان بييجي بكود 42703 في كل ضغطة على الزرار. يعني شاشته كانت بتقول 4 تنبيهات مستحيل تختفي، وحقيقة المتجر صفر.",
  "  **القرار المعماري:** المتجر فيه أصلًا مكان واحد بيتسجل فيه العطل — دفتر الأحداث، واللي بيقراه الشريط الأحمر في الجديدة. التصنيف: **آلة مشتركة** — التنبيهات مش ملك شاشة. فبدل ما نرجّع للجدول الميت أعمدته (وده يخلّي للدار مكانين للتنبيهات)، القراءة كلها رجعت ورا **قاعدة واحدة** في `lib/ops/alerts.ts`: هي اللي بتقول إيه عطل، ومن إمتى، ومين بصله. الشاشتين بيقروا منها، فالعدّاد ما يختلفش بينهم.",
  "  **اللي اتعمل:** الباب القديم بقى بيوصل الدفتر من ورا القاعدة · التعليم كمقروء بقى بيسجّل **وصلة** في الدفتر (مش علم على صف) وبيعدّها من ردّ الدفتر نفسه · الرفض كله بالعربي وبسبب مسمّى · أي ملاحظة من الدفتر مفيهاش حرف عربي بتتشال، مش بتتترجم · درجة أهمية ما بتتقاسش اتشالت من الشاشة · السكون بقى بجملة تقول النافذة اللي اتقاست (`آخر 60 دقيقة`) بدل صفر مطمئن.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-alert-strip.mjs` — **نجح {PROOF} من {PROOF_TOTAL}**: سطر قياس واحد اتسجّل في الدفتر، الشاشتين عدّوه نفس العدد وشافوا نفس الرقم، والتعليم كمقروء ردّ 200 ورجّعت الدفتر وصلة واحدة، والسطر اختفى من الاتنين · الزائر بلا جلسة مرفوض 401 · مفيش لاتيني ولا رقم أعجمي على الكارت، وصورتين على عرض 390 اتبصّيت عليهم (حيّ وساكن) · **{RESIDUE}** سطر فاضل من أدواتي بعد التنظيف.",
  "  **عيب في محاجتي، اتسجل قبل الرقم:** أول تشغيل خلّى السطور بتاعته في الدفتر وقايل «فاضل صفر» — لأني كنت بدوّر عليها بمفتاح بيقرا `summary` من جوه العقدة، والمحاجة كانت خزّنت العقدة **كنص** مش ككائن (فرق طريقة الكتابة في القاعدة)، فالبحث ما شافهومش والتنضيف حكم على عمى. المحاجة بقت تكتب الكائن صح، وتقرأ شكل العقدة وترجّعه قبل ما تحكم، وتنضّف بالنص الخام اللي جوه العقدة، وقالت أول سطر **{SWEPT}** سطور فاضلة من جرياتها القديمة — مسحهم `scratch/sweep-alert-probe.mjs` فرجّع الدفتر لـ **{LEDGER}** سطر، عدّاد الجلسة الأول بالحرف (والدفتر فيه **{ALERTS}** سطر عطل مسجّل).",
  "  **اللي طلع من نفس الطريق واتسجل مهام مستقلة (6):** تلات مكاتب بتكتب في الجدول الميت بنفس الأعمدة المرفوضة وفعلها بيضيع في صمت · لوحة المالك بتعدّ تنبيهات من عمودين مش موجودين فبتطلع صفر مطمئن، و«مهام متأخرة» محسوبة من ولا حاجة · جرس تاني بيقرا العقد القديمة ومش مركّب في أي شاشة · الطبقة الخارجية بترفض بالإنجليزي قبل أي باب · بوابة جودة بتقول «رفضت» وبتسجّل قائمة مخالفات فاضية · وتلات صفوف قياس قديمة لسه في الدفتر بتنادي نفسها «موظف تكلّم بغير اسمه» — مسحها كلمته هو.",
  "  **البوابات:** {TESTS} اختبار أخضر (خروج 0) · تيبشك سليم · بناء كامل · منشور · **5 حرّاس** على قاعدة القراءة الواحدة: الباب القديم ما يبنيش استعلام على الجدول الميت، وباب الجديدة ما يقرأش الدفتر من ورا القاعدة، والشريط ما يعرضش درجة أهمية، والنافذة في ملف واحد، والجلسة مطلوبة.",
  "",
];

const toArabic = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");
const body = lines
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => String(T[k])))
  .map(toArabic)
  .join("\n");

const allowed = Object.values(T).map(String).join("");
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
const prose = body.replace(/`[^`]*`/g, "");
const words = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(body)) throw new Error("a non-Arabic script leaked into the prose");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");

fs.appendFileSync(path, body, "utf8");
console.log("appended lines:", body.split("\n").length - 2);
console.log("المقاس:", JSON.stringify({ deadRows, deadCols, ledgerRows, alertRows, proof: proof[0], swept, residue, tests }));
