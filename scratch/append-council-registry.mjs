import fs from "node:fs";
import { spawnSync } from "node:child_process";

const gitShow = (ref) => {
  const r = spawnSync("git", ["show", ref], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("could not read " + ref + ": " + String(r.stderr).slice(0, 120));
  return r.stdout;
};

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const readers = stripAnsi(fs.readFileSync("scratch/measure-settings-readers.out", "utf8"));
const proof = stripAnsi(fs.readFileSync("scratch/prove-registry-names.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/registry-tests.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/registry-gates.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const KEYS = num(/^keys in the table: (\d+)/m, readers, "table keys");
const FILES = num(/^code files walked: (\d+)/m, readers, "walked files");
const LIVE = num(/^SPLIT live=(\d+)/m, readers, "live keys");
const ADMIN_ONLY = num(/^SPLIT live=\d+ admin-only=(\d+)/m, readers, "admin-only keys");
const NO_CODE = num(/no-code=(\d+)/, readers, "keys no code touches");

const PROOF = num(/RESULT: (\d+) of/m, proof, "proof passed");
const PROOF_TOTAL = num(/^RESULT: \d+ of (\d+)/m, proof, "proof total");
const CARDS = num(/^cards on the desk: (\d+)/m, proof, "cards rendered");
const KEY_SHAPES = num(/^machine-key shapes visible on the page: (\d+)/m, proof, "machine keys on screen");
const LATIN_DIGITS = num(/^desk latin digits: (\d+)/m, proof, "latin digits on the desk");
const RECORD_KEYS_SEEN = num(/^the record holds keys: (\d+)/m, proof, "record keys in the proof");
const NUMBERS_IN_RECORD = num(/^contact_numbers entries: (\d+)/m, proof, "numbers in the record");
const DAY_DIGITS = num(/^digits in the stored day: (\d+)/m, proof, "digits in the stored day");
const RESIDUE_LINE = num(/^residue counted: (\d+)/m, proof, "residue counted");

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/VITEST_EXIT=(\d+)/, gates, "vitest exit") !== 0) throw new Error("the test run refused");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");

const OLD_NAMED = (gitShow("HEAD~2:lib/settings/facts.ts").match(/^\s*(\{ )?key: "/gm) ?? []).length;
const NEW_NAMED = (fs.readFileSync("lib/settings/facts.ts", "utf8").match(/^\s*(\{ )?key: "/gm) ?? []).length;
const GUARDS = (fs.readFileSync("tests/settings/facts.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

if (NEW_NAMED !== KEYS) throw new Error(`the registry names ${NEW_NAMED} of ${KEYS}`);
if (LIVE + ADMIN_ONLY + NO_CODE !== KEYS) throw new Error("the reader split does not add up");
if (CARDS !== LIVE) throw new Error(`the desk rendered ${CARDS} cards for ${LIVE} live keys`);
if (RESIDUE_LINE !== ADMIN_ONLY) throw new Error("the residue count on the page is not what the code census said");

const T = {
  KEYS, FILES, LIVE, ADMIN_ONLY, NO_CODE, OLD_NAMED, NEW_NAMED, GUARDS, TESTS,
  PROOF, PROOF_TOTAL, CARDS, KEY_SHAPES, LATIN_DIGITS, RECORD_KEYS_SEEN, NUMBERS_IN_RECORD, RESIDUE_LINE, DAY_DIGITS,
};

const now = new Date();
const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (${today} ${hh}:${mm}):** **مكتب الإعدادات بقى بيسمي العشرين مفتاح — والتلاتة اللي السجل ما كان بيعرفش أسماءهم اتسمّوا.**`,
  "  **القياس الأول:** الكود نفسه اتلفّ (**{FILES}** ملف) والجدول اتقرا من جواه: فيه (**{KEYS}**) مفتاح · (**{LIVE}**) منهم بيقرا قيمتهم كود بره شاشات الإدارة · (**{ADMIN_ONLY}**) ما بيقربش منهم غير تبويبات اللوحة القديمة · (**{NO_CODE}**) ما بيلمسهمش كود خالص · وسجل الحقائق كان بيسمي (**{OLD_NAMED}**) بس، فالّتلاتة اللي اتكتبت بعده — رقم الشغل، وسطر التحقق بخطوتين، وبصمة النسخة الليلية — مالهاش اسم، ولو كانت اتعرضت على شاشة كانت هتطلع باسم الكود بتاعها.",
  "  **القرار:** كل واحد منهم بقى له اسم عربي وحالة بتتقري من السجل وقت ما الصفحة تتبني: كام رقم مسجّل · التحقق بخطوتين مقفول بأمر المالك ولا شغّال · يوم آخر نسخة وكم سطر وجدول اتنقلوا وكم حاجة فشلت · وصاحب الحالة واحد: لو نوع القيمة اتضاف وما اتعملوش سطر حالة، الحارس بيقف.",
  "  **وعيب في الكلام اتصلّح:** المكتب كان بيقول عن الباقي «ما بيقرأهاش أي سطح» — والقياس قال إن اللوحة القديمة لسه بيقرا ويكتب كل الـ (**{ADMIN_ONLY}**) دول، بس مفيش صفحة عميل بتعرض حاجة منهم · بقى السطر يقول «مفيش شاشة بتعرضها للعميل»، وده اللي المسطرة بتثبته.",
  "  **وعيب في المكتب نفسه كشفه القياس الحيّ:** أول ما المكتب اتبنى، سطر يوم النسخة الليلية طبع اليوم زي ما هو مخزّن، يعني (**{DAY_DIGITS}**) أرقام لاتينية قدام المالك على شاشة عربية · الرقم اللي بيسمّي (تاريخ أو آخر أربعة في موبايل) بيمرّ على محوّل الأرقام العربي، واللي بيجمع (عداد) بيمرّ على صيغة الأرقام · الحارس بقى يمنع الطبعة القديمة، والقياس اتعاد فطلع (**{LATIN_DIGITS}**).",
  "  **وعيب تاني في مِقياسي أنا:** أول جولة قالت «في خطأ كونسول على المكتب» — والقياس المنفصل `scratch/measure-quality-door.mjs` قال إن الخطأ من صفحة اللوحة القديمة اللي الأداة سابتها وهي لسه مستنية رد، فالرسالة كانت من رحلتي مش منصفحته · الأداة بقى بتفتح المكتب في تبويب جديد، والخطأ اختفى.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-registry-names.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: السجل بره قال (**{RECORD_KEYS_SEEN}**) مفتاح · المكتب عرض (**{CARDS}**) كارت، فيهم التلاتة الجداد · كارت الأرقام قال (**{NUMBERS_IN_RECORD}**) زي ما في السجل بالحرف · كارت النسخة الليلية طلع بيومها · كارت التحقق بخطوتين قال مقفول بأمر منك · العداد تحت قال (**{RESIDUE_LINE}**) قيمة · (**{KEY_SHAPES}**) اسم كود باين على الشاشة و(**{LATIN_DIGITS}**) رقم لاتيني في كلام المكتب · مفيش خطأ كونسول، والصورة اتبصّ عليها · والأداة ما كتبتش ولا سطر (قراءة بس).",
  "  **اللي طلع من نفس القياس واتسجل مهمة:** الـ (**{ADMIN_ONLY}**) مفتاح اللي مالهمش قارئ غير اللوحة القديمة بقوا مهمة (**١٥٤**): لما اللوحة تتمسح، ولا واحد منهم هيبقى له محرّر — فكل واحد محتاج قرار: يتنقل للكابينة بقارئ حقيقي، أو يفضل باقِة · ومسح أي سطر في السجل كلمة صريحة منك، مش قرار وكيل.",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حراس** على سجل الحقائق والمكتب.",
  "  **وملاحظة اتسجلت زي ما هي:** باب البناء الكامل رفض مرة واحدة على نفس الكود واتعاد فعدّى، والسبب ما اتقاسش — اتسجل تحت مهمة الاختبارات اللي بتفشل تحت الحمل (**٩٧**).",
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
