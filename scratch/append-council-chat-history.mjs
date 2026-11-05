import fs from "node:fs";
import postgres from "postgres";
import dotenv from "dotenv";

for (const f of [".env.local", ".env"]) {
  const p = process.cwd() + "/" + f;
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const proof = stripAnsi(fs.readFileSync("scratch/prove-chat-history-lands.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/tests-chat.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const PROOF = num(/النتيجة: (\d+) نجح/, proof, "proof passed");
const PROOF_TOTAL = num(/نجح من (\d+)/, proof, "proof total");
const RESIDUE = num(/فاضل من علامتي (\d+) · فاضل في التنفيذ/, proof, "chat residue");
const TURN_ROWS = num(/سطور نزلت من كلمتي: (\d+)/, proof, "turn rows");
const BEFORE = num(/قبل القياس: مجموع سطور المحادثة (\d+)/, proof, "rows before");
const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
const GUARDS = (fs.readFileSync("tests/ops/chatHistoryOneWriter.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
let columns = 0;
let rowsNow = 0;
let ledgerRows = 0;
let memRows = 0;
try {
  columns = (await sql`select count(*)::int c from information_schema.columns where table_schema='public' and table_name='chat_history'`)[0].c;
  rowsNow = (await sql`select count(*)::int c from chat_history`)[0].c;
  ledgerRows = (await sql`select count(*)::int c from ops_sync_events`)[0].c;
  memRows = (await sql`select count(*)::int c from agent_memory`)[0].c;
} finally {
  await sql.end();
}

if (rowsNow !== BEFORE) throw new Error(`chat_history moved during the run: ${BEFORE} -> ${rowsNow}`);
if (RESIDUE !== 0) throw new Error("the instrument left rows behind");

const T = { PROOF, PROOF_TOTAL, RESIDUE, TURN_ROWS, BEFORE, TESTS, GUARDS, COLUMNS: columns, LEDGER: ledgerRows, MEM: memRows };

const now = new Date();
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (٢٠٢٦-١٠-٢٤ ${hh}:${mm}):** **كلام المالك مع المساعد بقى بيتسجّل — الجدول كان فاضي من يومه، والحماية اللي حواليه ما كانتش بتشتغل.**`,
  "  **القياس على القاعدة الحيّة:** `chat_history` بيجاوب لـ **{COLUMNS}** أعمدة وفيه **{BEFORE}** سطر · الكتابة كانت بترسل **٣** أسماء مش فيهم (الجلسة، والأمر، ونتيجة الأمر) فالقاعدة كانت بترفض كل كلمة من أول يوم · والرفض كان بيضيع في حماية مكتوبة حوالين الكتابة **ما بتشتغلش**: بردة القاعدة بترجع خطأ كقيمة، مش استثناء، فالكود اللي كان مستني استثناء ما شاف حاجة — ولا حتى سجل قال إن حاجة باظت · ومن نفس الطريق قراءة التاريخ كانت بتطلب العمود المختلع نفسه، فالشاشة كانت عمياء من الناحيتين وبان إنها فاضية عن جد.",
  "  **القرار المعماري:** باب واحد للكلمات (`lib/ops/chat-record.ts`) — بيشيل الأعمدة **الأربعة** اللي الجدول بيجاوبها وبس، ويحط الجلسة والأمر ونتيجتهم في عمود التفاصيل اللي الجدول بيجاوبه، بيرجّع رقم السطر من ردّ القاعدة، وبيعترف بالرفض بجملة عربية بسبب مسمّى · التصنيف: **آلة مشتركة** — الكلام ملك المالك مش ملك شاشة، فباب القراءة بيقرأ من نفس الباب، واللوحة اللي بتعرض التاريخ بتقول «سجل محادثاتنا ما قريش» بدل السكوت المطمئن · عمود الشخص هنا مفتاحه الأجنبي بيشاور على حسابات الدخول فعلًا (عكس مخزن الذاكرة)، فالسطر بيتسجّل باسم صاحبه.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-chat-history-lands.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: كلمة وردّها نزّلوا **{TURN_ROWS}** سطر في السجل باسم صاحبها وبحلقة الجلسة جوه التفاصيل · الباب رجّع التاريخ من السجل بالترتيب الصح، والصفحة عرضت الكلمة القديمة بعد ما قفلتها وفتحتها على عرض ٣٩٠ والصورة اتبصّيت عليها · قارئ بلا جلسة اترفض ٤٠١ وما كتبش سطر · مفيش أخطاء كونسول · **{RESIDUE}** سطر فاضل من أدواتي بعد التنضيف في التلات مواضع، والجدول رجع **{BEFORE}** سطر.",
  "  **اللي طلع من نفس القياس:** نجوم التنسيق لسه بتطبع حرفيًا على شاشة المساعد (مهمة مستقلة اتسجلت من الذرة اللي قبلها، والقياس ده كشفها تاني على شاشة تانية) · ومخزن الذاكرة رجع **{MEM}** سطر (= عدده قبل ذرة النهاردة)، فالكتابة الجديدة ما بعتتش حاجة للجدول ده بالخطأ.",
  "  **البوابات:** {TESTS} اختبار أخضر (خروج ٠) · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حارس**: مفيش كتابة على الجدول برّه، ومفيش اسم عمود مش موجود، ومفيش بلع للرفض، واللوحة بتعترف إنها ما قريتش.",
  "  **الدفتر:** {LEDGER} سطر في دفتر المتجر دلوقتي.",
  "",
];

const toArabic = (s) =>
  s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

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
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(body)) throw new Error("a non-Arabic script leaked into the prose");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");
if (body.includes("undefined") || body.includes("NaN")) throw new Error("a token had no measured value");

fs.appendFileSync(path, body, "utf8");
console.log("appended lines:", body.split("\n").length - 2);
console.log("المقاس:", JSON.stringify(T));
