import fs from "node:fs";
import { spawnSync } from "node:child_process";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const counted = stripAnsi(fs.readFileSync("scratch/measure-counted-tables.out", "utf8"));
const proof = stripAnsi(fs.readFileSync("scratch/prove-cache-verdict.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/cache-fullsuite.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/cache-gates.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const COUNTED = num(/^tables the status loop counts: (\d+)/m, counted, "counted tables");
const ABSENT = (counted.match(/^ABSENT/gm) ?? []).length;
const PRESENT = (counted.match(/^PRESENT/gm) ?? []).length;

const PROOF = num(/RESULT: (\d+) of/m, proof, "proof passed");
const PROOF_TOTAL = num(/^RESULT: \d+ of (\d+)/m, proof, "proof total");
const TABLE_STATUS = num(/^the record's answer about the cache table: status=(\d+)/m, proof, "cache table status");
const RPC_ROWS = num(/^the cache-hit function in the record: (\d+)/m, proof, "cache rpc rows");
const ARSENAL = num(/^admin arsenal door: status=(\d+)/m, proof, "arsenal status");
const ARSENAL_BYTES = num(/^admin arsenal door: status=\d+ bytes=(\d+)/m, proof, "arsenal bytes");
const CHAT_STATUS = num(/^consultant answer: status=(\d+)/m, proof, "consultant status");
const CHAT_MS = num(/^consultant answer: status=\d+ ms=(\d+)/m, proof, "consultant ms");
const CHAT_BYTES = num(/reply bytes=(\d+)/, proof, "consultant reply bytes");
const PAGE_CHARS = num(/^home page text at 390px: (\d+)/m, proof, "home page chars");
const ADVISOR = /^advisor bubble present: (\w+)/m.exec(proof)?.[1];
const LEFT = num(/^rows left by the instrument: sessions=(\d+)/m, proof, "rows before cleanup");
const CLEANED = num(/^rows after cleanup: sessions=(\d+)/m, proof, "rows after cleanup");

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/VITEST_EXIT=(\d+)/, gates, "vitest exit") !== 0) throw new Error("the test run refused");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
const GUARDS = (fs.readFileSync("tests/ops/cacheStorageVerdict.test.ts", "utf8").match(/^\s*it\(|^\s*it\.each/gm) ?? []).length;

const grep = spawnSync("git", ["grep", "-l", "semantic_cache", "--", "lib", "app"], { encoding: "utf8" });
if (grep.status !== 0) throw new Error("the file grep refused");
// The verdict module itself only asks the record whether the table exists; the tier is the rest.
const TOUCHERS = new Set(grep.stdout.split("\n").map((f) => f.trim()).filter((f) => f && f !== "lib/ops/cache-storage.ts")).size;

if (PRESENT + ABSENT !== COUNTED) throw new Error("the counted split does not add up");
if (CHAT_STATUS !== 200 || CHAT_BYTES === 0) throw new Error("the consultant did not answer on the live link");
if (ADVISOR !== "true") throw new Error("the advisor bubble is not on the page the cache serves");
if (LEFT !== 1) throw new Error("the run did not create exactly one conversation row: " + LEFT);
if (CLEANED !== 0) throw new Error("the instrument left a conversation row behind: " + CLEANED);

const T = {
  COUNTED, ABSENT, PRESENT, PROOF, PROOF_TOTAL, TABLE_STATUS, RPC_ROWS, ARSENAL, ARSENAL_BYTES,
  CHAT_STATUS, CHAT_MS, CHAT_BYTES, PAGE_CHARS, LEFT, CLEANED, TESTS, GUARDS, TOUCHERS,
};

const now = new Date();
const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (${today} ${hh}:${mm}):** **الطبقة اللي مالهاش تخزين بقى تعرف نفسها — مفيش رحلة مرفوضة جوه كل رد.**`,
  "  **القياس الأول:** السجل ما فيهوش جدول المخزن الذكي أصلًا، ولا دالة تسجيل الإصابة فيه، ولا أي مفتاح من مفاتيح المخزن السريع الأربعة متظبوط · ومع كده (**{TOUCHERS}**) ملفات بتقرا وتكتب في الجدول ده على طرق حقيقية — محادثة المسترشد للعميل، وباب الترسانة، وباب الإعدادات الذكية، وأبواب التعلم · كل رد كان بيدّي رحلة والسجل بيرفض برقم خطأ معناه «الجدول ده مالوش وجود»، والرفض كان بيبلع نفسه، والعدادات كانت بتقول صفر — الرقم اللي بيقوله المخزن الفاضي، مش المخزن اللي مالوش مكان.",
  "  **القرار:** سؤال واحد للسجل بيرد بحقيقة واحدة في أول رحلة لكل نسخة، وكل قارئ وكاتب بيسمع نفس الرد · من غير تخزين، الكتابة بتتحسب «مكانها مش موجود» والقراية بترد «مفيش» من غير ما تدق · والجدول ما اتعملش دلوقتي: القياس لقى نفس الاسم في ملفين بعمودين مختلفين تمامًا (واحد بالمفتاح والنص والرد، وواحد بالبايت والنوع والإصابة) ودالة ناقصة — ده قرار في هيكل السجل مش جدول يتخمين.",
  "  **وعيب تاني اتصلّح في نفس الرحلة:** عداد حالة القاعدة كان بيقول «صفر سطر» لأربع جداول من (**{COUNTED}**) مالهمش وجود في السجل أصلًا — رقم بيطمّن وغلط · بقى العداد بيسمّي الناقص بالاسم وبيعدّ الموجود فعلا (**{PRESENT}**).",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-cache-verdict.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: السجل بره قال عن جدول المخزن رقم حالة (**{TABLE_STATUS}**) ودالة الإصابة سطورها (**{RPC_ROWS}**) · المسترشد رد على سؤال حقيقي بـ(**{CHAT_BYTES}**) حرف عربي في (**{CHAT_MS}**) ملّي ثانية من غير ما يدق الجدول الناقص · باب الترسانة رد (**{ARSENAL}**) بـ(**{ARSENAL_BYTES}**) حرف · صفحة العميل الرئيسية — اللي عليها فقاعة المسترشد — عند عرض **٣٩٠** (**{PAGE_CHARS}** حرف) من غير خطأ كونسول والصورة اتبصّ عليها · والأداة خلّفت سطر محادثة واحد باسمها، مسحته بنفسها ورجع (**{CLEANED}**).",
  "  **اللي طلع من نفس القياس واتسجل مهمة:** العقل نفسه موجود في ملفين، (**١٦**) دالة بنفس الاسم في الاتنين — وكل إصلاح لازم يتكتب مرتين أو يطبّق على نص النظام بس (مهمة **١٥٦**).",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حراس** على الرد الواحد وعلى إن الرحلة المرفوضة ما تتعملش.",
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
