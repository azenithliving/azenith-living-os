import fs from "node:fs";
import { spawnSync } from "node:child_process";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const counted = stripAnsi(fs.readFileSync("scratch/measure-counted-tables.out", "utf8"));
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

const grep = spawnSync("git", ["grep", "-l", "semantic_cache", "--", "lib", "app"], { encoding: "utf8" });
if (grep.status !== 0) throw new Error("the file grep refused: " + grep.stderr.slice(0, 120));
const TOUCHERS = new Set(grep.stdout.split("\n").map((f) => f.trim()).filter(Boolean)).size;

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/VITEST_EXIT=(\d+)/, gates, "vitest exit") !== 0) throw new Error("the test run refused");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
const GUARDS = (fs.readFileSync("tests/ops/cacheStorageVerdict.test.ts", "utf8").match(/^\s*it\(|^\s*it\.each/gm) ?? []).length;

if (PRESENT + ABSENT !== COUNTED) throw new Error("the counted split does not add up");

const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
const T = { COUNTED, ABSENT, PRESENT, TOUCHERS, TESTS, GUARDS };

const title = "fix(cache): الطبقة اللي مالهاش تخزين بقى تعرف نفسها — مفيش رحلة مرفوضة كل رد";

const msg = `${title}

القياس على الرابط المنشور: جدول المخزن الذكي مش موجود في السجل، ودالة تسجيل الإصابة مش موجودة كمان، ولا أي مفتاح من مفاتيح المخزن السريع الأربعة متظبوطة · ومع كده (${AR(TOUCHERS)}) ملفات بتقرا وتكتب في الجدول ده، وطرقها حقيقية: محادثة المسترشد للعميل، وباب الترسانة، وباب الإعدادات الذكية، وأبواب التعلم · يعني كل رد كان بيدّي رحلة مرفوضة والسجل بيرفض برقم خطأ معناه «الجدول ده مالوش وجود»، والرفض كان بيبلع نفسه في صمت، والعدادات كانت بتقول صفر — وهو الرقم اللي بيقوله المخزن الفاضي، مش المخزن اللي مالوش مكان أصلًا.

القرار: سؤال واحد للسجل بيرد بحقيقة واحدة في أول رحلة لكل نسخة، وكل اللي بيقرا أو بيكتب يسمع نفس الرد · لو مفيش تخزين، الكتابة بتتحسب «مكتوبة على مكان مش موجود» والقراية بترد «مفيش» من غير ما تدق · والجدول ما اتعملش دلوقتي، لأنه محتاج قرار في هيكل السجل (عمودين مختلفين لنفس الاسم في ملفين، ودالة ناقصة)، مش جدول يتخمين · واللي بيوهم إن في مخزن بقى يقول حالته: (${AR(PRESENT)}) جدول من (${AR(COUNTED)}) موجود فعلا والباقي (${AR(ABSENT)}) مالهمش وجود، فبقوا بيتسمّوا بالاسم بدل صفر.

البوابات: ${AR(TESTS)} اختبار أخضر · تيبشك سليم · بناء كامل · ${AR(GUARDS)} حراس على الرد الواحد وعلى إن الرحلة المرفوضة ما تتعملش.`;

const prose = msg.replace(/^fix\([a-z]+\): /, "");
const latin = (prose.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => w !== "cache");
if (latin.length) throw new Error("Latin words leaked: " + latin.join(", "));
if (/[0-9]/.test(prose)) throw new Error("Latin digits leaked");
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(msg)) throw new Error("a non-Arabic script leaked");
if (msg.includes("undefined") || msg.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", msg, "utf8");
console.log("measured:", JSON.stringify(T));
console.log(msg);
