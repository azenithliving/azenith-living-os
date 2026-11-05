import fs from "node:fs";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const tests = stripAnsi(fs.readFileSync("scratch/relations-fullsuite.out", "utf8"));
const build = stripAnsi(fs.readFileSync("scratch/relations-build.out", "utf8"));
const doorTestSource = fs.readFileSync("tests/intel-relations.test.ts", "utf8");
const probe = stripAnsi(fs.readFileSync("scratch/measure-schema-probe.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
const TEST_EXIT = num(/EXIT=(\d+)/, tests, "test exit");
const BUILD_EXIT = num(/EXIT=(\d+)/, build, "build exit");
if (TEST_EXIT !== 0 || BUILD_EXIT !== 0) throw new Error("a gate did not pass");

const doorPart = doorTestSource.slice(0, doorTestSource.indexOf('describe("Smart Agent API Contract"'));
const GUARDS = (doorPart.match(/^\s*it\(/gm) ?? []).length;
if (GUARDS < 5) throw new Error("the door lost its guards: " + GUARDS);

// The measurement this atom stands on: the old read answered "no such table" for the system view,
// and the new read answered every column of every table it was asked about.
const BLIND = (probe.match(/^INFORMATION_SCHEMA ok=false/gm) ?? []).length;
const PROBED = (probe.match(/^PROBE /gm) ?? []).length;
if (BLIND !== 1) throw new Error("the blindness measurement is missing");
if (PROBED < 19) throw new Error("the probe measurement is incomplete: " + PROBED);

const TABLES = 4;
const T = { TESTS, GUARDS, TABLES, PROBED };

const lines = [
  "باب فحص العلاقات بقى بيقرا السجل فعلًا — القياس قال إنه كان بيسأل المخزن عن فهرس النظام، والمخزن ما بيقدرش يخدمه، فالرد كان «مفيش جدول بالاسم ده» على جداوله **{TABLES}**، وكل عمود فيهم اتقال عليه ناقص وهو موجود · الباب كان بيقول الحقيقة عن نفسه بس ما كانش بيقدر يجاوب السؤال اللي اتعمل عشانه",
  "الباب بقى بيسأل الجدول عن الأعمدة اللي الكود بيكتبها ويقرأ الرفض: رفض بيسمي العمود الناقص، ورفض تاني بيسمي الجدول الغايب، وجدول فاضي بيرد من غير خطأ — فالقياس ما بقاش بيعتمد على وجود صفوف، وده اتقاس على جدول فيه صفوف وعلى جدول فاضي قبل ما يتكتب سطر، والقياس الأول عدّ **{PROBED}** عمود على السجل الحيّ",
  "الطلب اتنضّف كمان من عمود ما كانش في السجل أصلًا، فكان بيكلّف رحلة مرفوضة مع كل حفظ قاعدة، والقاري كان بيقرأ عمود ما يجيش أبدًا",
  "اللي طلع من نفس القياس واتسجل مهام مستقلة: جدول سجل الأحداث فاضي (صفر سطر) وكاتبه بيرمي خطأ المحاولة التانية على الأرض، ومحرك الاستكشاف بيعدّ جداول المتجر بنفس الطريقة العمياء، ومكتب القواعد بيكتب اسم تاني لنفس العلم",
  "البوابات: **{TESTS}** اختبار أخضر (خروج صفر) · تيبشك سليم · بناء كامل (خروج صفر) · **{GUARDS}** حراس على الباب، منهم واحد بيثبت إن الباب ما بقاش بيسأل فهرس النظام، وواحد بيثبت إن نصف قراءة ما بتتحسبش قياس",
];

const toArabic = (s) =>
  s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const body = lines
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => String(T[k])))
  .map(toArabic)
  .join("\n\n");

const allowed = Object.values(T).map(String).join("");
const words = (body.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
if (/[\u0590-\u05ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(body)) throw new Error("a non-Arabic script leaked");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");
if (body.includes("undefined") || body.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", "fix(intel): " + body + "\n", "utf8");
console.log("المقاس:", JSON.stringify(T));
