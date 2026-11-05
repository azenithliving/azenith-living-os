import fs from "node:fs";
import { execFileSync } from "node:child_process";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const proof = stripAnsi(fs.readFileSync("scratch/prove-reply-drawn.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/tests-renderer2.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const PROOF = num(/النتيجة: (\d+) نجح/, proof, "proof passed");
const PROOF_TOTAL = num(/نجح من (\d+)/, proof, "proof total");
const RESIDUE = num(/فاضل (\d+)$/m, proof, "residue");
const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
const GUARDS = (fs.readFileSync("tests/talk/replyRendererOneOwner.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;
const SHARED_LINES = fs.readFileSync("components/talk/MarkdownContent.tsx", "utf8").split(/\r?\n/).length;

const stat = execFileSync("git", ["show", "--numstat", "--format=%s", "HEAD"], { encoding: "utf8" }).trim().split("\n");
const chatPanel = stat.find((l) => l.includes("components/admin/agents/ChatPanel.tsx"));
if (!chatPanel) throw new Error("the chat panel is not in the last commit");
const CUT = Number(chatPanel.split("\t")[1]);
if (!Number.isFinite(CUT) || CUT < 100) throw new Error(`unexpected cut size: ${chatPanel}`);

const T = { PROOF, PROOF_TOTAL, RESIDUE, TESTS, GUARDS, CUT, SHARED_LINES };

const now = new Date();
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (٢٠٢٦-١٠-٢٤ ${hh}:${mm}):** **نجوم التنسيق اختفت من شاشة المساعد — القاعدة كانت موجودة، بس ما كانش لها باب.**`,
  "  **القياس على شاشته:** الراسم اللي بيحوّل «**كلمة**» لكلمة ثقيلة كان مكتوب **جوه ملف شات الموظفين نفسه** ومن غير تصدير، فالقاعدة اللي اتعملت في ذرة قديمة ما كانتش توصل لغيره · تلات شاشات بترد على المالك وبتطبع النجوم على الزجاج: درج المساعد، وصحة المساعد الموحّد، ولوحة المتصفح الحي · والصورتين اللي اتبصّيت عليهم امبارش قبل النهاردة (ردّ التفضيل ورجيع المحادثة) فيها الجملة مطبوعة بحروفها.",
  "  **القرار المعماري:** الراسم بقى في وحدة واحدة ليها بيت واحد (**{SHARED_LINES}** سطر)، وشات الموظفين بقى بيسألها زي الباقي (**{CUT}** سطر اتمسحوا من ملفه) · الحارس بيقول دلوقتي إن ولا ملف تاني في المكوّنات بعرّف راسم تاني، وإن مفيش شاشة من الشاشات التلاتة بتطبع ردّ الباب في سطر عادي · والدرج المقفول لسه بيقلّم السطور الطويلة، فالرسم ما خلّاش الرد الطويل ياكل الشاشة.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-reply-drawn-not-printed.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: الباب بعت ردّه وفيه نجوم فعلًا (فالشاشة هي اللي رسمت، مش الباب الليغيها) · الدرج طلع «حفظت تفضيلك» **مرسومة** ومفيش ولا عنصر على الشاشة بيطبع زوج نجوم · صفحة المساعد رجّعت التاريخ من السجل مرسوم كمان · مفيش أخطاء كونسول · **{RESIDUE}** سطر فاضل من أدواتي (محادثة ٢ وذاكرة ١ وسجل تنفيذ ١ اتمسحوا)، وجدول المحادثة رجع لصفر.",
  "  **عيب جديد طلع من الصورة (اتسجل مهمة):** عنوان كارت في لوحة المالك بيطبع الاسم الإنجليزي جوه العربية («ذكاء الإنتاج» مع الاسم اللاتيني في قوسين) — وقع من كل مرّة التنضيف لأنّه في عنوان مش في ردّ.",
  "  **البوابات:** {TESTS} اختبار أخضر (خروج ٠) · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حراس** على البيت الواحد.",
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
