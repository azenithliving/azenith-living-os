import fs from "node:fs";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const proof = stripAnsi(fs.readFileSync("scratch/prove-daily-report-loop-broken.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/loop3-fullsuite.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/loop3-gates.out", "utf8"));
const split = stripAnsi(fs.readFileSync("scratch/measure-pending-split.out", "utf8"));
const sweep = stripAnsi(fs.readFileSync("scratch/measure-report-paper.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const PROOF = num(/النتيجة: (\d+) نجح/, proof, "proof passed");
const PROOF_TOTAL = num(/نجح من (\d+)/, proof, "proof total");
const DOOR_COUNT = num(/^the pile it counted: (\d+)/m, proof, "door count");
const BEFORE = num(/^waiting papers before: (\d+)/m, proof, "before");
const AFTER = num(/^waiting papers after: (\d+)/m, proof, "after");
const SKIPPED = num(/فيه (\d+) ورقة مستنية نفس الطلب/, proof, "already waiting");
const SAME = num(/assistant_analytics -> (\d+)/, split, "same kind papers");
const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
const GUARDS = (fs.readFileSync("tests/ops/dailyReportNoLoop.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;
const PENDING_AFTER_SWEEP = num(/^PENDING_NOW=(\d+)/m, sweep, "pending after sweep");

if (AFTER !== BEFORE) throw new Error("the pile moved while the job ran");
if (!sweep.includes("deleted")) throw new Error("the instrument's leftover paper was not swept");

const T = { PROOF, PROOF_TOTAL, DOOR_COUNT, BEFORE, AFTER, SKIPPED, SAME, TESTS, GUARDS, PENDING_AFTER_SWEEP };

const now = new Date();
const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (${today} ${hh}:${mm}):** **التقرير اليومي بقى ما يفتحش ورق على مكتبك — والحلقة اللي كانت بتغذي نفسها اتقطعت.**`,
  "  **القياس الأول:** الشغل المجدول كان بيفتح ورقة كل يوم الساعة ٨ و١١ دقيقة، والشرط كان «في ورق مستني»، والورقة اللي بيفتحها هي نفسها ورق مستني · التل بقى **{DOOR_COUNT}** ورقة، **{SAME}** منهم سؤال واحد متكرر («تقرير أرقام») بنفس العلة.",
  "  **القرار:** بقى التل بيتعدّ عدّ صحيح (الباب قال **{DOOR_COUNT}** والسجل فيه **{DOOR_COUNT}**، بعد ما كان بيقول **٥٠** من **{DOOR_COUNT}** لأن العد كان صفحة مقصوصة) · والورقة بتتفتح بس لما التقرير نفسه يلاقى حاجة مكسورة، وبيقول إيه هي · وقبل ما يفتح، بيسأل: فيه سؤال مستني نفس الحاجة؟ لو فيه، مفيش نسخة تانية · ولو السجل ما ردّش على السؤال ده، بيقول كده بدل ما يخمن.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-daily-report-loop-broken.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: الباب جرى والتقرير اتعمل واتخزن · عدّ **{DOOR_COUNT}** زى السجل بالظبط · قال «أرقام آخر أسبوع ما جتش» وسجّل السبب، وما فتحش نسخة تانية («فيه **{SKIPPED}** ورقة مستنية نفس الطلب») · التل قبل **{BEFORE}** وبعد **{AFTER}** · الأداة مسحت سطر التقرير اللي كتبته وسطر الورقة اللي خلّفتها الجولة الأولى، فالتل بقى **{PENDING_AFTER_SWEEP}** · كابينة المالك فتحت من غير خطأ كونسول، والصورة اتبصّ عليها.",
  "  **اللي طلع من نفس القياس واتسجل مهمة:** العلّة نفسها — أرقام المتجر بتتقرا بمفتاح المتصفح المقفول، فالسجل بيرفض والورقة بتقول «مش معروف» لخمسة أرقام، بينما نفس الجداول بترد على مفتاح المتجر نفسه (مقاس في نفس الجولة) · علاجه قرار لك لأنه مش قراءة بس: اتنين من المواضع دي كتابة، وتحويلهم على مفتاح المتجر معناه إن المساعد يقدر يعدّل فعلًا.",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حراس** على التقرير وحلقته.",
  "",
];

const toArabic = (s) =>
  s.replace(/`[^`]*`|[^`]+/g, (chunk) =>
    chunk.startsWith("`")
      ? chunk
      : chunk.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬"),
  );

const body = lines
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => String(T[k])))
  .map(toArabic)
  .join("\n");

const allowed = Object.values(T).map(String).join("") + "50";
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
console.log("المقاس:", JSON.stringify(T));
