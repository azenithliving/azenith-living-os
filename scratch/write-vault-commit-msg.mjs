import fs from "node:fs";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const tests = stripAnsi(fs.readFileSync("scratch/vault-fullsuite.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/vault-gates.out", "utf8"));
const vaultMeasure = stripAnsi(fs.readFileSync("scratch/measure-recovery-vault.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
if (num(/TESTS_EXIT=(\d+)/, gates, "tests exit") !== 0) throw new Error("the suite failed");

const MISSING = (vaultMeasure.match(/^TABLE MISSING/mg) ?? []).length;
if (MISSING !== 2) throw new Error("the missing-table census is off: " + MISSING);
const vaultSource = fs.readFileSync("lib/auth/vault.ts", "utf8");
const PATHS = (vaultSource.match(/from\("recovery_vault"\)/g) ?? []).length;
if (PATHS < 5) throw new Error("the vault path census is off: " + PATHS);

const guardSource = fs.readFileSync("tests/ops/auditOneWriter.test.ts", "utf8");
const GUARDS = (guardSource.match(/^\s*it\(/gm) ?? []).length;

const T = { TESTS, PATHS, MISSING, GUARDS };

const lines = [
  "خزنة الاسترجاع بقى أثرها راكب على الباب الواحد — القياس قال إن الجدول اللي الخزنة بتسجّل فيه أثرها مش موجود أصلًا، والجدول اللي خزنة الكودات نفسها بتخزن فيه مش موجود كمان (**{MISSING}** جدول غايب)، و**{PATHS}** مسار في ملفها بيقرأ ويكتب في الغايب · يعني رجوع الحساب ما كانش بيفشل عشان كود غلط: مفيش تخزين من الأساس",
  "الأثر بقى بيمشي على الباب اللي بيسمع الرفض ويرجع رقم السطر، فالوصلة اتسجلت في مكان حقيقي بدل رفّ ميت · اسم الجدول الغايب اتمسح من المشروع كله، وحارس بيقرا كل ملف بيثبت إنه ما يرجعيش",
  "باب الاسترجاع العام هيتقاس على الرابط المنشور بعد النشر: مفيش محاولة تنجح، ومفيش كود يتسرب في الرد، ومفيش محاولة تكتب سطر في أي سجل",
  "البوابات: **{TESTS}** اختبار أخضر · تيبشك سليم · بناء كامل · **{GUARDS} حراس** على الباب الواحد",
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

fs.writeFileSync("scratch/commit-msg.txt", "fix(auth): " + body + "\n", "utf8");
console.log("المقاس:", JSON.stringify(T));
