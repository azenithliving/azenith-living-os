import fs from "node:fs";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const tests = stripAnsi(fs.readFileSync("scratch/loop2-fullsuite.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/loop2-gates.out", "utf8"));
const split = stripAnsi(fs.readFileSync("scratch/measure-pending-split.out", "utf8"));
const proof = stripAnsi(fs.readFileSync("scratch/prove-daily-report-loop-broken.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
if (num(/TESTS_EXIT=(\d+)/, gates, "tests exit") !== 0) throw new Error("the suite failed");

const RECORD = num(/^PENDING_ALL=(\d+)/m, split, "pending all");
const CAPPED = num(/^the pile it counted: (\d+)/m, proof, "capped count");
const GUARDS = (fs.readFileSync("tests/ops/dailyReportNoLoop.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

const T = { TESTS, RECORD, CAPPED, GUARDS };

const body =
  "التقرير اليومي بقى يعدّ الورق المستني كله — القياس على الرابط المنشور قال إن الباب قال **{CAPPED}** والسجل فيه **{RECORD}**، لأن العد كان بيستخدم صفحة مقصوصة بفلتر لموظفين بس، واللوحة بتاعته بتعرض كل المستني · بقى في عدّاد واحد للسؤال ده، بيرد بـ«ما اتقاسش» لو السجل ما ردّش، مش صفر مطمئن · والورقة اللي بتطلب توقيعه بقى ليها رقم في الرد عشان أي سطح يشير لها · وفيه رقم لاتيني كان داخل في وصف الورقة («آخر ٧ يوم») بقى بحروفه · **{TESTS}** اختبار أخضر · **{GUARDS} حراس** على التقرير وحلقته";

const toArabic = (s) =>
  s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const out = toArabic(body.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => String(T[k])));

const allowed = Object.values(T).map(String).join("");
const prose = out.replace(/^fix\(cron\):\s*/, "");
const words = (prose.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
const strays = (prose.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
if (/[0-9]/.test(out)) throw new Error("a Latin digit survived");
if (out.includes("undefined") || out.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", "fix(cron): " + out + "\n", "utf8");
console.log("المقاس:", JSON.stringify(T));
