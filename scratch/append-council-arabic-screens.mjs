import fs from "node:fs";
import { execFileSync } from "node:child_process";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const proof = stripAnsi(fs.readFileSync("scratch/prove-arabic-run3.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/tests-gloss2.out", "utf8"));
const census = stripAnsi(execFileSync(process.execPath, ["scratch/census-admin-english-v2.mjs"], { encoding: "utf8" }));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const PROOF = num(/النتيجة: (\d+) نجح/, proof, "proof passed");
const PROOF_TOTAL = num(/نجح من (\d+)/, proof, "proof total");
const ARABIC_NODES = num(/لوحة المالك بتتكلم عربي كفاية يشوفها · عقد عربية (\d+)/, proof, "dashboard arabic nodes");
const DOOR_COUNT = num(/الباب عدّ الموافقات: (\d+) →/, proof, "door approvals");
const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
const GUARDS = (fs.readFileSync("tests/admin/screensSpeakArabicOnly.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;
const SCANNED = num(/^scanned files=(\d+)/m, census, "scanned files");
const TERMS_LEFT = num(/^hits=(\d+)/m, census, "latin terms left");
const DIGITS_LEFT = num(/^latin_digit_nodes=(\d+)/m, census, "latin digit nodes left");

const T = { PROOF, PROOF_TOTAL, ARABIC_NODES, DOOR_COUNT, TESTS, GUARDS, SCANNED, TERMS_LEFT, DIGITS_LEFT };

const now = new Date();
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (٢٠٢٦-١٠-٢٤ ${hh}:${mm}):** **عناوين شاشاته بقت عربي مرة واحدة، وأرقام كروته بحروفه — الصورة هي اللي قالت.**`,
  "  **القياس على شاشته:** العنوان كان بيقول الكلمة بالعربي وبعدين بيكررها في قوس بحروف لاتينية · العدّ على ١٠١ ملف من شاشاته طلع **١٣** حاشية كده في **٦** ملفات (لوحة المالك، مكتب الإدارة، درج الوكلاء، تيار الأحداث، نبض النظام، رادار العملاء) — منها «عنوان الموقع» متبع باسمه اللاتيني في قوس · وفي الصورة اللي اتبصّيت عليها على عرض ٣٩٠ طلع إن العناوين اتظبطت بس الأرقام لسه بره: كارتان بيعدّوا بحروف لاتينية جنب كارت بعدّ بحروفه، وكارت الإيراد كان بيسأل لغة المتصفح عن شكل الرقم، فالرقم له صاحبين.",
  "  **القرار المعماري:** العربية فضلت والمكرر اتمسح · الرقم بقى له صاحب واحد: الكارت بيعدي أي عدد على العدّاد العربي اللي باقي شاشاته بتستخدمه، وسؤال المتصفح اتمسح من الملف · والحارس الجديد بيقرا المنسوخ اللي على الشاشة (عناوين وتسميات الحقول) من **{SCANNED}** ملف، وبيثبت الأول إنه بيمسك العيب في ملف مزروع — فالخضر مش مجاني، وده نفس الغلط اللي خلّى عنوان الإنتاج يعدي كل مرّة تنضيف: الحرّاس كانت بتقرا الردود مش العناوين.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-screens-speak-arabic.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: لوحة المالك فيها **{ARABIC_NODES}** عبارة عربية ومفيش ولا واحدة فيهم بحاشية إنجليزية · مكتب الإدارة عرضت عناوينه الستة من غير قوس · مفيش رقم لاتيني واحد على اللوحة، والباب عدّ الورق المستني بـ **{DOOR_COUNT}** واللوحة طبعته بحروفه (**٥٧**) · مفيش أخطاء كونسول · الذرة دي ما كتبتش ولا سطر في السجل، فمفيش حاجة تتنضّف (القياس كله قراءة).",
  "  **اللي طلع من نفس العدّ واتسجل مهمة:** **{TERMS_LEFT}** مصطلح لاتيني و**{DIGITS_LEFT}** موضع بأرقام لاتينية لسه في نصوح شاشاته — دول قرار تسمية (إيه العربي بتاع كلمة الظهور في البحث، وإيه اللي يفضل باسمه اللاتيني لأنه اسم المنتج نفسه) مش تكرار، فسايبهم لكلمة، مش محو آلي.",
  "  **البوابات:** {TESTS} اختبار أخضر (خروج ٠) · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حراس** على شاشة بتتكلم عربي.",
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
