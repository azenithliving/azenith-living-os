import fs from "node:fs";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const measure = stripAnsi(fs.readFileSync("scratch/measure-settings-scope-refusal.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/runtime-tests.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/runtime-gates.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const COLUMNS = num(/^site_settings columns in the record: (\d+)/m, measure, "settings columns");
const STATUS = num(/^SCOPED read → status=(\d+)/m, measure, "scoped status");
const ROWS = num(/^UNSCOPED read → status=\d+ rows=(\d+)/m, measure, "unscoped rows");
const HAS_COMPANY_COL = /has company_id: (\w+)/.exec(measure)?.[1];
if (HAS_COMPANY_COL !== "false") throw new Error("the record now has a company column on settings: " + HAS_COMPANY_COL);

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/VITEST_EXIT=(\d+)/, gates, "vitest exit") !== 0) throw new Error("the test run refused");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
const GUARDS = (fs.readFileSync("tests/settings/runtimeRead.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
const T = { COLUMNS, STATUS, ROWS, TESTS, GUARDS };

const title = "fix(settings): قراية ثيم الموقع بقت رحلة واحدة — الفلتر اللي السجل بيرفضه اتشال من أول الصفحة";

const msg = `${title}

القياس على الرابط المنشور: جدول الإعدادات بيجاوب على (${AR(COLUMNS)}) عمود بس، ومفيش فيهم عمود للشركة · السؤال اللي كان بيتطرح أول كل صفحة كان بيرفض برقم حالة (${AR(STATUS)}) وبرقم خطأ معناه «العمود ده مالوش وجود» · وبعده كان الكود بيقرا نفس السطور من غير فلتر — يعني (${AR(ROWS)}) سطر بيوصلوا على أي حال، بس بعد ما راحت رحلتين قبلهم (واحدة تسأل عن الشركة وواحدة مرفوضة).

القرار: الفلتر الوهمي اتشال · القراية بقت رحلة واحدة على السجل · ولو السجل رفض، العيب بيتقال بصوت عالي والصفحة تفضل شغالة بالافتراضي — مفيش قراية تانية في الخفاء تسدّ مكانه · والفصل بين الشركات في الإعدادات قرار في هيكل السجل (عمود جديد وتعبية السطور القديمة)، مش فلتر يتكتب على التخمين.

البوابات: ${AR(TESTS)} اختبار أخضر · تيبشك سليم · بناء كامل · ${AR(GUARDS)} حراس على القراية نفسها (عدد الرحلات، ومنع اسم الشركة، والرفض مسموع).`;

const prose = msg.replace(/^fix\([a-z]+\): /, "");
const latin = (prose.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => w !== "settings");
if (latin.length) throw new Error("Latin words leaked: " + latin.join(", "));
if (/[0-9]/.test(prose)) throw new Error("Latin digits leaked");
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(msg)) throw new Error("a non-Arabic script leaked");
if (msg.includes("undefined") || msg.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", msg, "utf8");
console.log("measured:", JSON.stringify(T));
console.log(msg);
