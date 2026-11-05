import fs from "node:fs";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const tests = stripAnsi(fs.readFileSync("scratch/rules-fullsuite.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/rules-gates.out", "utf8"));
const shape = stripAnsi(fs.readFileSync("scratch/measure-automation-shape.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
if (num(/TESTS_EXIT=(\d+)/, gates, "tests exit") !== 0) throw new Error("the suite failed");

const REFUSED = num(/^REFUSED=(\d+)/m, shape, "refused names");
const SENT = (shape.match(/insert payload: ([^\n]+)/) ?? [])[1].split(",").length;
const FIRST_REFUSAL = (shape.match(/OLD_SHAPE_FIRST ok=(\w+)/) ?? [])[1];
if (FIRST_REFUSAL !== "false") throw new Error("the old shape did not get refused — the census is stale");

const shapeSource = fs.readFileSync("lib/ops/automation-shape.ts", "utf8");
const listLiteral = shapeSource.match(/AUTOMATION_WRITE_COLUMNS\s*=\s*\[([\s\S]*?)\]/);
if (!listLiteral) throw new Error("missing measurement: the declared column list");
const ANSWERED = (listLiteral[1].match(/"[a-z_]+"/g) ?? []).length;
const GUARDS = (fs.readFileSync("tests/ops/automationOneShape.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

const T = { TESTS, REFUSED, SENT, ANSWERED, GUARDS };

const lines = [
  "مكتب القواعد بقى ما يبعتش اسم مش في سجله — القياس قال إن السجل بيرفض **{REFUSED}** اسم من **{SENT}** اسم كان المكتب يبعتهم في كل حفظ قاعدة، فالرحلتين الأولانيين كانوا مرفوضين والتالتة بتنجح · وكان فيهم اسم تاني لنفس العلم: المكتب بيكتب «مفعّل» في عمود، وفي عمود تاني ما ليه وجود",
  "دلوقتي المكتب بيبعت الأعمدة **{ANSWERED}** اللي السجل بيعرفها بس، والحفظ بيحصل في رحلة واحدة · ولو حد رجع ضاف اسم بره القائمة، الباب بيقول الاسم بالعين بدل ما يخلّي السجل يرفضه بصمت · والقاري بقى بيقرا العلم من صاحبه الواحد",
  "الرحلة المرفوضة دي كانت بتسقط كمان مين عمل التعديل: السجل مالوش عمود للفاعل، فالمكتب كان يبعت اسم مش موجود ويحذفه بعد الرفض — بقى ما يبعتوش، فمفيش معلومة اتفقدت غير ما كانت موجودة أصلًا",
  "البوابات: **{TESTS}** اختبار أخضر · تيبشك سليم · بناء كامل · **{GUARDS} حراس** على شكل الصف الواحد، منهم واحد بيعدّ أسماء الملف نفسه وواحد بيثبت إن الرفض بيرجع من غير ما المكتب يعيد المحاولة",
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

fs.writeFileSync("scratch/commit-msg.txt", "fix(automation): " + body + "\n", "utf8");
console.log("المقاس:", JSON.stringify(T));
