import fs from "node:fs";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const proof = stripAnsi(fs.readFileSync("scratch/prove-rules-one-shape.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/rules-fullsuite.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/rules-gates.out", "utf8"));
const shape = stripAnsi(fs.readFileSync("scratch/measure-automation-shape.out", "utf8"));
const jump = stripAnsi(fs.readFileSync("scratch/measure-approval-jump.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const PROOF = num(/النتيجة: (\d+) نجح/, proof, "proof passed");
const PROOF_TOTAL = num(/نجح من (\d+)/, proof, "proof total");
const BEFORE = num(/^rules in the record before: (\d+)/m, proof, "rules before");
const AFTER = num(/^rules after cleanup: (\d+)/m, proof, "rules after");
const LEFT = num(/^marked rows left: (\d+)/m, proof, "leftover rules");
const STRANGER = num(/a stranger's save: status=(\d+)/, proof, "stranger status");
const BOARD_CHARS = num(/board characters: (\d+)/, proof, "board characters");
const RECORD_COLUMNS = num(/the record answers to: (\d+) columns/, proof, "record columns");
const REFUSED = num(/^REFUSED=(\d+)/m, shape, "refused names");
const SENT = (shape.match(/insert payload: ([^\n]+)/) ?? [])[1].split(",").length;
const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
const GUARDS = (fs.readFileSync("tests/ops/automationOneShape.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;
const PENDING = num(/^PENDING_NOW=(\d+)/m, jump, "pending papers");
const GROWING = (jump.match(/→ (2026-11-03)/g) ?? []).length;

if (AFTER !== BEFORE || LEFT !== 0) throw new Error("the instrument left a rule behind");

const T = {
  PROOF,
  PROOF_TOTAL,
  BEFORE,
  AFTER,
  LEFT,
  STRANGER,
  BOARD_CHARS,
  RECORD_COLUMNS,
  REFUSED,
  SENT,
  TESTS,
  GUARDS,
  PENDING,
  GROWING,
};

// The stamp comes from the clock, never copied: three entries earlier today carried a stale date.
const now = new Date();
const Y = now.getUTCFullYear();
const MO = String(now.getUTCMonth() + 1).padStart(2, "0");
const D = String(now.getUTCDate()).padStart(2, "0");
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");
const today = `${Y}-${MO}-${D}`;

const staleTitles = [
  "باب فحص العلاقات بقى بيقرا السجل فعلًا",
  "سجل الأحداث بقى له باب واحد بيسمع الرفض الصح",
  "خزنة الاسترجاع بقى أثرها راكب على الباب الواحد",
];

let ledger = fs.readFileSync(path, "utf8");
let corrected = 0;
for (const title of staleTitles) {
  const lines = ledger.split("\n");
  const at = lines.findIndex((line) => line.startsWith("- **الوكيل") && line.includes(title));
  if (at < 0) throw new Error("stale entry not found: " + title);
  const ar = (x) => x.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
  const staleDate = ar("2026-10-24");
  if (!lines[at].includes(staleDate)) throw new Error("the stale date was not found in: " + title);
  lines[at] = lines[at].split(staleDate).join(ar(today));
  ledger = lines.join("\n");
  corrected++;
}
fs.writeFileSync(path, ledger, "utf8");

const lines = [
  "",
  `- **الوكيل (${today} ${hh}:${mm}):** **تصحيح في السجل: ثلاثة أسطر اتكتبت النهارده بتاريخ يوم قديم.**`,
  "  **إزاي ده حصل:** أدوات السجل كانت بتاخد التاريخ منسوخ من سطر قديم بدل الساعة · التاريخ الصح **{TODAY_NUM}** واتكتب في السطور التلاتة اللي اتنشرت النهارده (**{CORRECTED}** سطر اتظبط)، ومن هنا السطر بيتختم بساعة الجهاز في نفس اللحظة · الغلط ده مهم لأن السجل هو المرجع: تاريخ غلط معناه إن أي حد يقيس «إمتى ده اتقاس» ياخد رقم مش حقيقي.",
  "",
  `- **الوكيل (${today} ${hh}:${mm}):** **مكتب القواعد بقى ما يبعتش اسم مش في سجله — والحفظ بقى في رحلة واحدة.**`,
  "  **القياس الأول:** السجل بيرفض **{REFUSED}** اسم من **{SENT}** اسم كان المكتب يبعتهم في كل حفظ قاعدة (الرحلتين الأولانيين مرفوضين والتالتة بتنجح) · وفيهم اسم تاني لنفس العلم: العلم راكب في عمود اسمه «مفعّل»، والمكتب كان يزيد عمود `is_active` ما ليه وجود في السجل (**{RECORD_COLUMNS}** عمود)، والقاري كان بيقرا العمود الوهمي الأول.",
  "  **القرار:** المكتب بقى يبعت الأعمدة اللي السجل بيعرفها بس، والحفظ بيحصل في رحلة واحدة · ولو أي اسم جديد اتضاف بره القائمة، الباب بيقوله بالعين ويوقف بدل ما يسيب السجل يرفضه بصمت · العلم بقى له صاحب واحد يكتبه وواحد يقراه · والرحلة المرفوضة كانت كمان بتبلع «مين عمل التعديل»: السجل مالوش عمود للفاعل، فالمكتب كان يبعت اسم مش موجود ويحذفه بعد الرفض — بقى ما يبعتوش.",  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-rules-one-shape.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: حفظ قاعدة من الباب الحقيقي رجّع سطر، والسطر طلع من السجل بعلمه وشغّال · قلب العلم من الباب ورجع السجل بيقوله مطفي · قائمة المكتب نفسها طلع عليها بنفس الحالة · الغريب بياخد (**{STRANGER}**) وما كتبش ولا قاعدة · الأداة مسحت قاعدتها بنفسها: فاضل **{LEFT}** وعدد الجدول رجع **{AFTER}** بعد ما كان **{BEFORE}** · لوحة المالك (**{BOARD_CHARS}** حرف) من غير خطأ كونسول، والصورة اتبصّ عليها.",
  "  **اللي طلع من نفس القياس واتسجل مهام:** الورق المستني في مكتب القرارات بقى **{PENDING}** بدل ٥٧ اللي قاستهم الصبح، و**{GROWING}** وصف فيهم لسه بيزيد النهارده — في منتج شغال بيرمي أوراق مستنية من غير حد يقرر فيها · وفيه سطر عربي وصفه اتخزّن علامات استفهام (**؟؟؟**): حرف اتلف وقت الكتابة.",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حراس** على شكل الصف الواحد.",
  "",
];

const body = lines
  .map((l) =>
    l
      .replace(/\{([A-Z_0-9]+)\}/g, (_, k) => String(T[k] ?? (k === "TODAY_NUM" ? today : k === "CORRECTED" ? corrected : "undefined")))
      .replace(/`[^`]*`/g, (chunk) => chunk),
  )
  .map((l) =>
    l.replace(/`[^`]*`|[^`]+/g, (chunk) =>
      chunk.startsWith("`")
        ? chunk
        : chunk.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬"),
    ),
  )
  .join("\n");

const allowed = Object.values(T).map(String).join("") + today + String(corrected);
const prose = body.replace(/`[^`]*`/g, "");
const strays = (prose.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
const words = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(body)) throw new Error("a non-Arabic script leaked into the prose");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");
if (body.includes("undefined") || body.includes("NaN")) throw new Error("a token had no measured value");

fs.appendFileSync(path, body, "utf8");
console.log("corrected stale dates:", corrected);
console.log("appended lines:", body.split("\n").length - 2);
console.log("المقاس:", JSON.stringify(T), "today=" + today);
