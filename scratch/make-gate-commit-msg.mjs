import fs from "node:fs";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const rows = stripAnsi(fs.readFileSync("scratch/measure-gate-rows.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/gate-fullsuite.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/gate-gates.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const FAILED = num(/^quality_gate_failed rows=(\d+)/m, rows, "failed rows");
const FAILED_EMPTY = num(/^quality_gate_failed rows=\d+ emptyViolationList=(\d+)/m, rows, "failed rows with an empty list");
const PASSED = num(/^quality_gate_passed rows=(\d+)/m, rows, "passed rows");
const WITH_SUMMARY = num(/quality_gate_failed rows=\d+ emptyViolationList=\d+ withSummary=(\d+)/m, rows, "failed rows with a summary");
const BACKUP = num(/same gate rows in the p7 backup relation: (\d+)/, rows, "backup rows");

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/VITEST_EXIT=(\d+)/, gates, "vitest exit") !== 0) throw new Error("the test run refused");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
const GUARDS = (fs.readFileSync("tests/ops/gateNote.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

if (FAILED_EMPTY !== FAILED) throw new Error("not every refusal row was empty — re-measure before claiming");
if (WITH_SUMMARY !== 0) throw new Error("some rows already carry a summary — the before story changed");

const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
const T = { FAILED, FAILED_EMPTY, PASSED, WITH_SUMMARY, BACKUP, TESTS, GUARDS };

const titleBase = "بوابة الجودة بقى بتقول إيه اللي رفضته — " + AR(FAILED) + " سطر كان فاضي";

const msg = `fix(gate): ${titleBase}

القياس في دفتر المتجر نفسه: (${AR(FAILED)}) سطر بيقول إن بوابة الجودة رفضت شغل، و(**${AR(FAILED_EMPTY)}**) منهم قائمة أسبابهم فاضية، و(**${AR(WITH_SUMMARY)}**) فيهم سطر فيه جملة تتقري · و(**${AR(PASSED)}**) سطر نجاح · و(**${AR(BACKUP)}**) سطر زيهم قاعدين في نسخة قديمة من الدفتر · السبب في الكود: اللي بيبعت السطر كان بيفلتر نتائج الفحص على خاصية «نوع المنع» اللي مالهاش وجود في نتيجة الفحص أصلًا، فالقائمة كانت بتطلع فاضية في كل مرة، والشاشة كانت تقدر تقول «بوابة الجودة رفضت عملاً» وبس — ولا سطح بيقدر يقول إيه اللي اترفض.

القرار: قرار الرفض والسبب بقوا من نفس القائمة في محرك الدستور — المنع بيتحسب منها وهي نفسها بتتخزّن في التقرير · الباب بقى بيبعت اللي المحرك سماّه، مش فلتر بيخترع · والسطر بقى يمشيه جملة عربية بعدد الأسباب وأسمائهم وأول سبب، والجملة بتعدي على نفس الميزان اللي بيقرر إن الكلام ده بلغته ولا لأ · ولو الرفض جه من غير سبب مسمّى، السطر بقى يقول «البوابة رفضت من غير ما تسمّي سبب — في تناقض في الفحص» بدل ما يسكت · والسطور القديمة ما اتغيّرش (ده سطر في دفتره، ومفيش سطر بيت مسح غير بكلمة صريحة منه).

البوابات: ${AR(TESTS)} اختبار أخضر · تيبشك سليم · بناء كامل · ${AR(GUARDS)} حراس على إن الرفض يتقال.`;

const prose = msg.replace(/^fix\([a-z]+\): /, "");
const latin = (prose.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => w !== "gate");
if (latin.length) throw new Error("Latin words leaked: " + latin.join(", "));
if (/[0-9]/.test(prose)) throw new Error("Latin digits leaked");
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(msg)) throw new Error("a non-Arabic script leaked");
if (msg.includes("undefined") || msg.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", msg, "utf8");
console.log("measured:", JSON.stringify(T));
console.log(msg);
