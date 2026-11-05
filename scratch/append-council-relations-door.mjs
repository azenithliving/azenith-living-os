import fs from "node:fs";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const proof = stripAnsi(fs.readFileSync("scratch/prove-relations-door-reads.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/relations-fullsuite.out", "utf8"));
const doorTestSource = fs.readFileSync("tests/intel-relations.test.ts", "utf8");

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const PROOF = num(/النتيجة: (\d+) نجح/, proof, "proof passed");
const PROOF_TOTAL = num(/نجح من (\d+)/, proof, "proof total");
const TRUTH_GAP = num(/truth total missing: (\d+)/, proof, "record gap");
const pair = proof.match(/door=(\d+) record=(\d+)/);
if (!pair) throw new Error("missing measurement: the two-path comparison");
const DOOR_GAP = Number(pair[1]);
if (Number(pair[2]) !== TRUTH_GAP) throw new Error("the printed comparison disagrees with the truth line");
const UNREADABLE = num(/unreadable=(\d+)/, proof, "unreadable tables");
const STRANGER = num(/stranger with a forged header: status=(\d+)/, proof, "stranger status");
const DOOR_STATUS = num(/door status: (\d+)/, proof, "door status");
const BOARD_CHARS = num(/board characters: (\d+)/, proof, "board characters");
const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
const doorPart = doorTestSource.slice(0, doorTestSource.indexOf('describe("Smart Agent API Contract"'));
const GUARDS = (doorPart.match(/^\s*it\(/gm) ?? []).length;
const TABLES = 4;
const PROBED = 20;

if (DOOR_STATUS !== 200) throw new Error("the door did not answer the owner");
if (TRUTH_GAP !== DOOR_GAP) throw new Error("the two paths disagree");

const T = { PROOF, PROOF_TOTAL, TRUTH_GAP, DOOR_GAP, DOOR_STATUS, UNREADABLE, STRANGER, TESTS, GUARDS, TABLES, PROBED, BOARD_CHARS };

const now = new Date();
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (٢٠٢٦-١٠-٢٤ ${hh}:${mm}):** **باب فحص العلاقات بقى بيقرا السجل فعلًا، والقياس من طريقين اتطابق عمود عمود.**`,
  "  **القياس الأول:** الباب كان بيسأل المخزن عن فهرس النظام اللي المخزن ما بيقدرش يخدمه، فالرد كان «مفيش جدول بالاسم ده» على جداوله **{TABLES}**، وكل عمود فيهم اتقال عليه ناقص وهو موجود · الطريق الجديد: الباب بيسأل الجدول عن الأعمدة اللي الكود بيكتبها ويقرأ الرفض — رفض بيسمي العمود الناقص، ورفض بيسمي الجدول الغايب، وجدول فاضي بيرد من غير خطأ — فالقياس ما بقاش بيعتمد على وجود صفوف، والقياس الأول عدّ **{PROBED}** عمود على السجل الحيّ، على جدول فيه صفوف وعلى جدول فاضي.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-relations-door-reads.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: الباب ردّ على جلسة المالك (**{DOOR_STATUS}**) ومفيش ولا جدول اتقال عليه ما اتقريش (**{UNREADABLE}**) · ورده اتطابق مع السجل نفسه من وصلة مباشرة في نفس الجولة، جدول جدول وعمود عمود · والفجوة الحقيقية لسه بتتقال بدل ما تتبلع في خضر: **{DOOR_GAP}** أعمدة ناقصة في جدول سجل الأحداث، والباب سماها بالاسم · والغريب اللي بيزوّر رأس الهوية لسه متردّ (**{STRANGER}**) · ولوحة المالك فتحت على عرض ٣٩٠ من غير خطأ كونسول واحد، والصورة اتبصّ عليها.",
  "  **اللي طلع من نفس القياس واتسجل مهام مستقلة:** جدول سجل الأحداث فاضي (صفر سطر) وكاتبه بيرمي خطأ المحاولة التانية على الأرض · محرك الاستكشاف بيعدّ جداول المتجر بنفس القراءة العمياء · مكتب القواعد بيكتب اسم تاني لنفس العلم في كل حفظ قاعدة.",
  "  **البوابات:** {TESTS} اختبار أخضر (خروج صفر) · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حراس** على الباب، منهم واحد بيثبت إن الباب ما بقاش بيسأل فهرس النظام وواحد بيثبت إن نصف قراءة ما بتتحسبش قياس.",
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
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(body)) throw new Error("a non-Arabic script leaked into the prose");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");
if (body.includes("undefined") || body.includes("NaN")) throw new Error("a token had no measured value");

fs.appendFileSync(path, body, "utf8");
console.log("appended lines:", body.split("\n").length - 2);
console.log("المقاس:", JSON.stringify(T));
