import fs from "node:fs";
import postgres from "postgres";
import dotenv from "dotenv";

for (const f of [".env.local", ".env"]) {
  const p = process.cwd() + "/" + f;
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const proof = stripAnsi(fs.readFileSync("scratch/prove-memory-one-writer.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/tests-memory.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const PROOF = num(/النتيجة: (\d+) نجح/, proof, "proof passed");
const PROOF_TOTAL = num(/نجح من (\d+)/, proof, "proof total");
const RESIDUE = num(/فاضل من علامتي (\d+)/, proof, "memory residue");
const EXEC_RESIDUE = num(/فاضل في السجل (\d+)/, proof, "execution residue");
const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
const GUARDS = (fs.readFileSync("tests/ops/memoryOneWriter.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;
const SANITY = num(/الجدول رجع لنفس العدد قبل القياس · قبل (\d+)/, proof, "table size before");

const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
let memTotal = 0;
let columns = 0;
let shelf = 0;
let ledgerRows = 0;
let chatRows = 0;
try {
  memTotal = (await sql`select count(*)::int c from agent_memory`)[0].c;
  shelf = (await sql`select count(*)::int c from agent_memory where category = 'admin_owner_memory'`)[0].c;
  columns = (await sql`select count(*)::int c from information_schema.columns where table_schema='public' and table_name='agent_memory'`)[0].c;
  ledgerRows = (await sql`select count(*)::int c from ops_sync_events`)[0].c;
  chatRows = (await sql`select count(*)::int c from chat_history`)[0].c;
} finally {
  await sql.end();
}

if (memTotal !== SANITY) throw new Error(`table moved during the run: ${memTotal} vs ${SANITY}`);
if (RESIDUE + EXEC_RESIDUE !== 0) throw new Error("the instrument left rows behind");

const T = {
  PROOF, PROOF_TOTAL, RESIDUE, TESTS, GUARDS, COLUMNS: columns, MEM: memTotal,
  SHELF: shelf, LEDGER: ledgerRows, CHAT: chatRows,
};

const now = new Date();
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (٢٠٢٦-١٠-٢٤ ${hh}:${mm}):** **كتابات مخزن الموظفين الست بقوا من باب واحد — والقياس الحيّ بيّن إن ولا واحد منهم كتب سطر في حياته.**`,
  "  **القياس على القاعدة الحيّة:** جدول الذاكرة بيجاوب لـ **{COLUMNS}** عمود، ومفيش فيه عمود شركة ولا صاحب ولا مصدر، وعمود «نوع الذاكرة» **مطلوب من غير افتراضي** · الكتّاب الستة كانوا بيبعتوا الأسماء المختلعة دي، وكلهم سابوا العمود المطلوب · **{MEM}** سطر في الجدول كلهم بالرفّ الافتراضي بتاع القاعدة، يعني ولا مكتب قدّر يكتب سطر واحد · وكلام المالك نفسه كان أسوأ حالة: `rememberOwnerPreference` كان بيرجّع نجاح لكتابة مرفوضة، والقارئ كان بيفلتر على عمود مش موجود، فالمساعد كان بيقول «حفظت تفضيلك» لتفضيل ما اتسجّلش · وفيه كتابة كانت لما ترفض تشيل الأعمدة الناقصة وتعيد الكرّة، فالفشل كان بيولّد سطر أنقص من اللي كان مفروض يتسجّل.",
  "  **القرار المعماري:** باب واحد للذاكرة (`lib/ops/memory-record.ts`) — هو اللي بيختار نوع السطر، وبيكتبه في العمودين اللي القاعدة بيجاوبهم، وبيرجّع رقم السطر من ردّ القاعدة نفسها، وبيعترف بالرفض بجملة عربية بسبب مسمّى · «مين صاحب الذاكرة» ما لقاش مكان ليه في الجدول ده: عمود الشخص فيه مفتاح أجنبي بيشاور على كشف العملاء (**٣٣** سطر)، والمالك اللي بيفتح اللوحة مش في الكشف (**١** حساب في القاعدة كلها، ومفيش له سطر هناك) — فبدل ما نخترع عمود تاني لنفس السؤال، رفّ المالك بقى بيتقرا من الرفّ نفسه، واسم صاحب القرار لسه جوه تفاصيل السطر · ومفيش ولا شاشة بتطبع نص القاعدة.",
  "  **اللي اتعمل كمان:** المكاتب الستة كلها بتمرّ من الباب الواحد (تفضيلات المالك، التقرير اليومي، تعديل السحابة، الأنماط المتعلمة، تطوير المشروع، مخزن الموظفين) · التقرير اليومي بقى يقول في رده هل السطر اتسجّل فعلًا · وباب فحص العلاقات بقى بيسأل عن الأعمدة العشرة اللي الكتابة بتبعتها فعلًا، بدل ما ينادي على ترحيل ما انطبّقش.",
  "  **عيب طلع من نفس القياس (باب الفحص):** كان بيسأل طبقة الوصول على منظر أنظمة مش بتخدمها، فالأربعة جداول اللي بيفحصهم كلهم رجعت «ناقص» كل أعمدتها — منهم جدول الورق اللي القاعدة بيجاوبه من أسابيع · بقى اللي ما يتقريش بيتسمى «الباب ما قدرش يقراه»، وعدد الناقص بيقف صفر لما القراءة نفسها مش موجودة، والسبب بيظهر في الردّ.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-memory-one-writer.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: المالك كتب «تذكّر إن…» بيده على عرض ٣٩٠ وشاف «حفظت تفضيلك»، والسطر نزل في السجل بنوعه في العمودين وعلى رفّه وبأولويته · سطر تاني رجّع للمساعد نفس التفضيل الأول من السجل قدامه · زائر بلا جلسة اترفض ٤٠١ وما كتبش سطر · **{SHELF}** سطر في رفّ المالك بعد ما كان فاضي · **{RESIDUE}** سطر فاضل من أدواتي، والجدول رجع **{MEM}** سطر (= عدده قبل القياس) · صورة الردّ اتبصّيت عليها.",
  "  **اللي طلع من نفس الطريق واتسجل مهام مستقلة (٣):** جدول محادثات المساعد (**{CHAT}** سطر من يومه) الكتابة فيه بترسل **٣** أعمدة مش موجودة والخطأ بيضيع في `console.error`، فالمساعد ما حفظش ولا كلمة من كلامه · باب الفحص ما بيقدرش يقرا الجدول أصلًا ومفيش شاشة بيناديه · ودرج المساعد بيطبع نجوم التنسيق حرفيًا على شاشة المالك (نفس العيب اللي اتقفل في الشات من قبل).",
  "  **البوابات:** {TESTS} اختبار أخضر (خروج ٠) · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حارس** على الباب الواحد: مفيش كتابة على الجدول برّه، ومفيش اسم عمود مش موجود، ومفيش شيل للعمودات وإعادة، والرفّ بيتقرا من الرفّ، والباب بيعترف إنه ما قراش.",
  "  **الدفتر:** {LEDGER} سطر في دفتر المتجر دلوقتي.",
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

fs.appendFileSync(path, body, "utf8");
console.log("appended lines:", body.split("\n").length - 2);
console.log("المقاس:", JSON.stringify({ ...T, EXEC_RESIDUE }));
