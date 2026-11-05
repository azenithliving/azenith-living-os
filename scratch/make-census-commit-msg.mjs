import fs from "node:fs";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const blind = stripAnsi(fs.readFileSync("scratch/measure-discovery-blind.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/census-tests.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const DEFINITIONS = num(/^INVENTORY definitions=(\d+)/, blind, "inventory definitions");
const PROBE_STATUS = num(/^== old existence probe → status=(\d+)/m, blind, "old probe status");
const SETTINGS = num(/read site_settings → status=\d+ range=\d+-\d+\/(\d+)/, blind, "settings total");
const RULES = num(/read automation_rules → status=\d+ range=\d+-\d+\/(\d+)/, blind, "rules total");
const RULE_COLUMNS = num(/^   columns\((\d+)\): id, company_id/m, blind, "rule columns");
const SETTINGS_COLUMNS = num(/^   columns\((\d+)\): key, value/m, blind, "settings columns");
const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
const GUARDS =
  (fs.readFileSync("tests/ops/recordInventory.test.ts", "utf8").match(/^\s*it\(|^\s*it\.each/gm) ?? []).length +
  (fs.readFileSync("tests/settings/facts.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;
const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const title =
  "fix(discovery): محرك الاستكشاف بقى بيشوف المتجر — الجرد بقى من وثيقة السجل نفسها والقراءتان ما يسألوش عن اسم مش موجود";

const body = [
  "",
  `القياس قال إن المحرك كان يسأل السجل «الجدول موجود؟» من شاشة نظام داخلية، والسجل ما بيردش على شاشات النظام · اتقاس على الرابط المنشور: الرفض برقم حالة ${AR(PROBE_STATUS)} · فالنتيجة كانت دايمًا صفر جدول وصفر إعداد وصفر قاعدة، والسجل نفسه بيقول إنه عنده ${AR(DEFINITIONS)} جدول، وفيه ${AR(SETTINGS)} سطر إعدادات (${AR(SETTINGS_COLUMNS)} أعمدة لكل سطر)، وفيه قاعدة واحدة (${AR(RULE_COLUMNS)} عمود) — يعني كل موظف ذكي كان بيبني صورته للمتجر على إنه فاضي.`,
  "",
  `وكان في عمى تاني وراه: قراءة القواعد كانت تطلب اسمين مالهمش وجود عند السجل، فلو حتى السؤال الأول نجح كانت القراءة تترفض · القراءة بقت تطلب الأسماء اللي السجل بيعرفها بس، والعلم بقى من صاحبه الوحيد.`,
  "",
  "والسر ما طلعش مع الجرد: مفتاح بوت التنبيه كان هيطلع في صورة الوكلاء وفي الرد اللي بيخرج لباب الإدارة أول ما العمى يرفع · القيمة بقت محجوبة، وصاحب «أي مفتاح ده سر» بقى واحد في سجل الحقائق نفسه، بدل قايمة كان الباب القديم بيحتفظ بنسخة منها — والباب رجع يسأل صاحبها.",
  "",
  `عدد الصفوف اتسجل «مش متقيس» بدل صفر · صفر كان بيخلي جار التنبيه يصرخ إن ${AR(DEFINITIONS)} جدول فاضيين.`,
  "",
  `${AR(TESTS)} اختبار أخضر · تيبشك سليم · بناء كامل · ${AR(GUARDS)} حراس على الجرد وعلى إن السر ما يطلعش.`,
].join("\n");

const msg = `${title}\n${body}`;
const prose = msg.replace(/^fix\([a-z]+\): /, "");
const latin = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => w !== "discovery");
if (latin.length) throw new Error("Latin words leaked: " + latin.join(", "));
if (/[0-9]/.test(prose)) throw new Error("Latin digits leaked");
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(msg)) throw new Error("a non-Arabic script leaked");
if (msg.includes("undefined") || msg.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", msg, "utf8");
console.log("measured:", JSON.stringify({ DEFINITIONS, PROBE_STATUS, SETTINGS, RULES, RULE_COLUMNS, SETTINGS_COLUMNS, TESTS, GUARDS }));
console.log(msg);
