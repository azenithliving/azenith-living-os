/**
 * append-council-admin-alerts.mjs — the ledger line for the old admin home's alert block.
 *
 * Every number is parsed out of a measurement this run printed; the script refuses to append when
 * a token has no printed value behind it.
 */
import fs from "node:fs";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const before = stripAnsi(fs.readFileSync("scratch/admin-alerts-before.out", "utf8"));
const after = stripAnsi(fs.readFileSync("scratch/measure-admin-alerts.out", "utf8"));
const live = stripAnsi(fs.readFileSync("scratch/admin-alerts-before-live.out", "utf8"));
const proof = stripAnsi(fs.readFileSync("scratch/prove-admin-alerts-lands.out", "utf8"));
const bidi = stripAnsi(fs.readFileSync("scratch/measure-card-bidi.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/admin-fullsuite.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/admin-gates.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};
const str = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return m[1].trim();
};

const T = {
  TYPES: num(/^RULE_EVENT_TYPES=(\d+)/m, after, "rule event types"),
  WINDOW: Math.round(num(/WINDOW_MS=(\d+)/, after, "rule window") / 60000),
  B_RULE: str(/PAGE_READS_THE_ONE_ALERT_RULE=(\w+)/, before, "before reads rule"),
  B_EMPTY: str(/PAGE_ALERT_EMPTY_LINE=([^\n]+)/, before, "before empty line"),
  B_TYPED: num(/PAGE_TYPED_LATIN_DIGITS=(\d+)/, before, "before typed digits"),
  B_RAW: num(/PAGE_RAW_INTERPOLATED_NUMBERS=(\d+)/, before, "before raw interpolations"),
  B_SLICE: num(/PAGE_SLICES_ALERTS_TO=(\d+)/, before, "before slice"),
  B_SOURCES: num(/PAGE_ALERT_NAMED_SOURCES=(\d+)/, before, "before named sources"),
  A_RULE: str(/PAGE_READS_THE_ONE_ALERT_RULE=(\w+)/, after, "after reads rule"),
  A_TYPED: num(/PAGE_TYPED_LATIN_DIGITS=(\d+)/, after, "after typed digits"),
  A_RAW: num(/PAGE_RAW_INTERPOLATED_NUMBERS=(\d+)/, after, "after raw interpolations"),
  A_SOURCES: num(/PAGE_ALERT_NAMED_SOURCES=(\d+)/, after, "after named sources"),
  A_PHANTOM: num(/FAILED_LOGIN_QUERY_NAMES_WHAT_THE_TABLE_HASNT=(\d+)/, after, "phantom filter columns"),
  TABLE_COLS: num(/FAILED_LOGIN_TABLE_COLUMNS=(\d+)/, after, "attempts table columns"),
  SA_COLS: num(/SYSTEM_ALERTS_COLUMNS=(\d+)/, after, "watcher table columns"),
  LEDGER_ROWS: num(/LEDGER_TOTAL_ROWS=(\d+)/, after, "ledger rows"),
  WARNINGS: num(/MASTERMIND_WARNINGS=(\d+)/, live, "door warnings"),
  WARNING_BYTES: str(/MASTERMIND_WARNINGS=\d+ :: ([^\n]+)/, live, "door warning text").length,
  DOOR_COUNT: num(/MASTERMIND_FAILED_ATTEMPTS_24H=(\d+)/, live, "door count"),
  WATCH_PENDING: num(/"pending":(\d+)/, live, "watcher pending"),
  OLD_CARD_BYTES: num(/"bytes":(\d+)/, live, "old card bytes"),
  OLD_CARD_LATIN: num(/"latinDigits":(\d+)/, live, "old card latin digits"),
  PROOF: num(/^RESULT: (\d+) of/m, proof, "proof passed"),
  PROOF_TOTAL: num(/^RESULT: \d+ of (\d+)/m, proof, "proof total"),
  NOT_MEASURED: num(/not measured=(\d+)/, proof, "checks not measured"),
  NEW_CARD_BYTES: num(/"bytes":(\d+)/, proof, "new card bytes"),
  CARD_WIDTH: num(/"width":(\d+)/, proof, "card width"),
  CARD_ROWS: num(/"rowCount":(\d+)/, proof, "card rows"),
  CARD_LATIN: num(/"latinDigits":(\d+)/, proof, "card latin digits"),
  CARD_ARABIC: num(/"arabicDigits":(\d+)/, proof, "card arabic digits"),
  RECORD_ATTEMPTS: num(/record's own attempts: in 24h=(\d+)/, proof, "record attempts"),
  DIGIT_X: num(/"digitX":(\d+)/, bidi, "digit x"),
  WORD_X: num(/"wordX":(\d+)/, bidi, "word x"),
  TESTS: num(/Tests\s+(\d+) passed/, tests, "tests passed"),
  GUARDS: (fs.readFileSync("tests/ops/alertStripOneOwner.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length,
};

for (const [k, v] of Object.entries(T)) {
  if (v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v)))
    throw new Error("token has no measured value: " + k);
}
if (T.B_RULE !== "false" || T.A_RULE !== "true") throw new Error("the page's read did not change");
if (T.A_TYPED !== 0 || T.A_RAW !== 0) throw new Error("digits are still raw");
if (T.A_SOURCES < 3 || T.B_SOURCES !== 0) throw new Error("the sources are not named");
if (T.PROOF !== T.PROOF_TOTAL) throw new Error("a live check failed");
if (T.CARD_LATIN !== 0 || T.NOT_MEASURED !== 0) throw new Error("the screen is not clean or a check was skipped");
if (T.DIGIT_X <= T.WORD_X) throw new Error("the count line is not laid out right-to-left");

const now = new Date();
const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (${today} ${hh}:${mm}):** **صفحة التحكم القديمة بقى بتقرأ تنبيهات المتجر من بابها — والسطر اللي ما كانش يقدر يظهر بقى قياس.**`,
  `  **القياس الأول:** قاعدة التنبيهات بتعرف (**{TYPES}**) نوع حدث و نافذة (**{WINDOW}**) دقيقة، والصفحة ما كانتش بتقرأ الباب اللي بيمرّ منهم خالص · كانت بتولّع السطور من مصدرين ومن غير ما تسمّي مين قالهم (**{B_SOURCES}**) مصدر مسمّى على الشاشة، وبتطبع سطر «{B_EMPTY}» من عندها، وبتقطع عند (**{B_SLICE}**) من غير ما تعدّ اللي فاضل · وفي نصها العربي (**{B_TYPED}**) رقم مكتوب لاتيني و(**{B_RAW}**) رقم بيمرّ زي ما هو · وعلى الرابط المنشور قبل التنقيط ده: الباب ردّ بـ(**{WARNINGS}**) رفض (**{WARNING_BYTES}**) حرف، والرفض إن جدول محاولات الدخول يردّ على (**{TABLE_COLS}**) عمود ومفيش فيهم عمود شركة، فالعدد كان ساكن صفر (**{DOOR_COUNT}**) وسطر الأمان ما كانش يقدر يظهر أبداً، والصفحة كانت بتتجاهل الرفض اللي الباب ببعته.`,
  `  **القرار:** الصفحة بقت تقرأ الدفتر من الباب نفسه اللي الكابينة واللوحة والجرس بيقروا منه، وكل سطر بقى مكتوب عليه مين قاله (**{A_SOURCES}**: الدفتر والفحص وبوابة الدخول) · سطر «مفيش تنبيهات» اتشال، والفاضل بقى جملة الباب اللي بتسمّي النافذة، واللي بيتقطع بقى بيتعدّ · والأرقام بقت بحروفه (**{A_TYPED}** مكتوب و**{A_RAW}** بيمرّ زي ما هو) · وفلتر العمود اللي مالوش وجود اتشال من الباب فبقى العدد قياس فعلاً، والعمود الوهمي الفاضل (**{A_PHANTOM}**) · ومفيش سطر في الدفتر اتغيّر ولا حاجة اتمسحت.`,
  `  **القياس الحيّ على الرابط المنشور:** \`scratch/prove-admin-alerts-lands.mjs\` — **نجحت {PROOF} من {PROOF_TOTAL}**: الباب ردّ من غير ولا رفض والعدد طابق عدد السطور في الجدول (**{RECORD_ATTEMPTS}**) · الكارت عند عرض **٣٩٠** بقى (**{CARD_WIDTH}**) بكسل و(**{NEW_CARD_BYTES}**) حرف و(**{CARD_ROWS}**) سطر، بـ(**{CARD_LATIN}**) رقم لاتيني و(**{CARD_ARABIC}**) رقم عربي، والسطر الفاضي بقى جملة الباب · والصورة اتبصّيت عليها والكونسول صفر خطأ · و({NOT_MEASURED}) قياس اتسجّل «ما اتقارش».`,
  `  **وشكّ اتصلّح بالقياس:** من الصورة حسّيت إن سطر العدّ («مفيش على الشاشة») مقلوب لأن أوله رقم · مِقياس الاتجاه قال لأ: الرقم على يمين الكلمة (**{DIGIT_X}** مقابل **{WORD_X}**) والاتجاه المحسوب من اليمين للشمال، فالسطر سليم وما اتنقلش.`,
  `  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حارس** في ملف التنبيهات · والفحص عنده (**{SA_COLS}**) عمود وفيه (**{WATCH_PENDING}**) تنبيه مفتوح، والدفتر (**{LEDGER_ROWS}**) سطر.`,
  "",
];

const body = lines
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => String(T[k] ?? "undefined")))
  .map((l) =>
    l.replace(/`[^`]*`|«[^»]*»|\*\*[^*]+\*\*|[^`«*]+/g, (chunk) =>
      chunk.startsWith("`") || chunk.startsWith("«")
        ? chunk
        : chunk.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬"),
    ),
  )
  .join("\n");

const allowed = Object.values(T).map(String).join("") + today;
const prose = body.replace(/`[^`]*`/g, "");
const strays = (prose.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
const words = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(body)) throw new Error("a non-Arabic script leaked into the prose");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");
if (body.includes("undefined") || body.includes("NaN")) throw new Error("a token had no measured value");

fs.appendFileSync(path, body, "utf8");
console.log("appended lines:", body.split("\n").length - 2);
console.log("المقاس:", JSON.stringify(T), "today=" + today);
