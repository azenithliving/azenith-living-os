import fs from "node:fs";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const rows = stripAnsi(fs.readFileSync("scratch/measure-gate-rows.out", "utf8"));
const proof = stripAnsi(fs.readFileSync("scratch/prove-gate-note-lands.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/gate-fullsuite2.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/gate-gates2.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const FAILED = num(/^quality_gate_failed rows=(\d+)/m, rows, "failed rows");
const FAILED_EMPTY = num(/^quality_gate_failed rows=\d+ emptyViolationList=(\d+)/m, rows, "empty failed rows");
const PASSED = num(/^quality_gate_passed rows=(\d+)/m, rows, "passed rows");
const BACKUP = num(/same gate rows in the p7 backup relation: (\d+)/, rows, "backup rows");

const PROOF = num(/RESULT: (\d+) of/m, proof, "proof passed");
const PROOF_TOTAL = num(/^RESULT: \d+ of (\d+)/m, proof, "proof total");
const BLOCKING = num(/allowed=false blocking=(\d+)/, proof, "blocking reasons");
const SUMMARY_BYTES = num(/summary bytes=(\d+)/, proof, "summary bytes");
const STRIP_ITEMS = num(/^the strip's door: status=\d+ items=(\d+)/m, proof, "strip items");
const LINE_BYTES = num(/the alert says what was refused in his Arabic · bytes=(\d+)/, proof, "strip line bytes");
const COCKPIT = num(/^cockpit text at 390px: (\d+)/m, proof, "cockpit chars");
const WROTE = num(/^rows this run wrote: (\d+)/m, proof, "rows written");
const LEFT = num(/^rows left behind: (\d+)/m, proof, "rows left");

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/VITEST_EXIT=(\d+)/, gates, "vitest exit") !== 0) throw new Error("the test run refused");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
const GUARDS = (fs.readFileSync("tests/ops/gateNote.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

if (FAILED_EMPTY !== FAILED) throw new Error("not every old refusal was empty");
if (LEFT !== 0 || WROTE !== 1) throw new Error("the instrument did not clean its own row");
if (LINE_BYTES < 40) throw new Error("the strip line is not explaining anything: " + LINE_BYTES);

const T = {
  FAILED, FAILED_EMPTY, PASSED, BACKUP, PROOF, PROOF_TOTAL, BLOCKING, SUMMARY_BYTES,
  STRIP_ITEMS, LINE_BYTES, COCKPIT, WROTE, LEFT, TESTS, GUARDS,
};

const now = new Date();
const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (${today} ${hh}:${mm}):** **بوابة الجودة بقى بتقول إيه اللي رفضته وعلى أي شغل — (${FAILED_EMPTY}) سطر كان فاضي.**`,
  "  **القياس الأول:** في دفتر المتجر (**{FAILED}**) سطر بيقول إن البوابة رفضت شغل، و(**{FAILED_EMPTY}**) منهم قائمة أسبابهم فاضية، و(**{PASSED}**) سطر نجاح، و(**{BACKUP}**) سطر زيهم قاعدين في نسخة قديمة من الدفتر · السبب في الكود: اللي بيبعت السطر كان بيفلتر نتائج الفحص على خاصية «نوع المنع» اللي نتيجة الفحص ما فيهاش أصلًا، فالقائمة كانت بتطلع فاضية دايمًا · والشاشة ما كانش في إيدها تقول أكتر من «بوابة الجودة رفضت عملاً»، فمفيش سطح بيقدر يقول إيه اللي اترفض ولا على إيه.",
  "  **القرار:** الرفض وأسبابه بقوا من نفس القائمة في محرك الدستور — المنع بيتحسب منها وهي نفسها بتتخزّن في التقرير، فالقرار والسبب ما ينفعش يختلفوا · والسطر بقى يمشيه جملة عربية بعدد الأسباب وأسمائهم وأول سبب، والجملة بتعدي على نفس الميزان اللي بيقرر إن الكلام ده بلغته ولا لأ · ولو الرفض جه من غير سبب مسمّى، السطر بقى يقول «البوابة رفضت من غير ما تسمّي سبب — في تناقض في الفحص» بدل ما يسكت · واسم الشغل اللي اترفض كان بيقع في الباب (المخطط بيسقط أي اسم مش مكتوب عنده) فبقى مطلوب وواصل لسطر الدفتر · والسطور القديمة ما اتغيّرش: ده دفتره، ومفيش سطر بيت مسح غير بكلمة صريحة.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-gate-note-lands.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: الباب رفض الشغل وسمّى (**{BLOCKING}**) أسباب · السطر اللي نزل في الدفتر سماّه باسم المسودة، وحمل (**{BLOCKING}**) أسباب و(**{SUMMARY_BYTES}**) حرف من الجملة العربية · وباب الشريط نفسه ردّ (**{STRIP_ITEMS}**) تنبيه، وسطر الرفض فيه (**{LINE_BYTES}**) حرف: «مدير تشغيل المحتوى — ٣ سبب يمنع النشر: موافقة بشرية للنشر ودقة المعاينة · محاولة نشر بلا موافقة بشرية صريحة» · الكابينة عند عرض **٣٩٠** (**{COCKPIT}** حرف) من غير خطأ كونسول والصورة اتبصّ عليها · والأداة كتبت (**{WROTE}**) سطر باسمها ومسحته: فاضل (**{LEFT}**).",
  "  **وعيب في مِقياسي اتصلّح:** أول جولة قالت «الشريط ما بيشوفش الرفض» — والشريط كان بيشوفه؛ الأداة كانت بتدوّر على شكل ردّ مش شكل الباب · اتقارن بالشكل الحقيقي (عنوان ورسالة) والقياس اتعاد.",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حراس** على إن الرفض يتقال وسببه واسمه.",
  "",
];

const body = lines
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => String(T[k] ?? "undefined")))
  .map((l) =>
    l.replace(/`[^`]*`|«[^»]*»|[^`«]+/g, (chunk) =>
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
