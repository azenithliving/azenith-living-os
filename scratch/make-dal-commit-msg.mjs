import fs from "node:fs";
import { spawnSync } from "node:child_process";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const before = stripAnsi(fs.readFileSync("scratch/measure-dal-before.out", "utf8"));
const after = stripAnsi(fs.readFileSync("scratch/measure-dal-after.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/dal-fullsuite.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/dal-gates.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const BEFORE_PHANTOM = num(/^phantom filters found: (\d+)/m, before, "phantoms before");
const BEFORE_PAIRS = num(/\(table\.column\) pairs found: (\d+)/, before, "pairs before");
const AFTER_PHANTOM = num(/^phantom filters found: (\d+)/m, after, "phantoms after");
const AFTER_PAIRS = num(/\(table\.column\) pairs found: (\d+)/, after, "pairs after");
const RELATIONS = num(/^columns read from the record for (\d+) relations/m, after, "relations");
const DAL_TABLES = num(/^tables the layer filters: (\d+)/m, after, "dal tables");

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/VITEST_EXIT=(\d+)/, gates, "vitest exit") !== 0) throw new Error("the test run refused");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
const GUARDS = (fs.readFileSync("tests/dal/recordColumns.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

// How many of the layer's own query objects anything actually calls.
const OBJECTS = ["usersDAL", "companiesDAL", "agentProfilesDAL", "agentTasksDAL", "agentConversationsDAL", "agentMessagesDAL", "salesOrdersDAL", "productionJobsDAL", "inventoryDAL", "approvalRequestsDAL", "realtimeDAL"];
const used = OBJECTS.filter((name) => {
  const r = spawnSync("git", ["grep", "-l", "-w", name, "--", "lib", "app", "components", "scripts"], { encoding: "utf8" });
  return r.stdout.split("\n").map((l) => l.trim()).filter((l) => l && l !== "lib/dal/unified-supabase.ts").length > 0;
});
const UNCALLED = OBJECTS.length - used.length;

if (AFTER_PHANTOM !== 0) throw new Error("phantom names are still in the layer: " + AFTER_PHANTOM);
if (BEFORE_PHANTOM === 0) throw new Error("the before measurement found nothing — it proves nothing");

const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
const T = { BEFORE_PHANTOM, BEFORE_PAIRS, AFTER_PHANTOM, AFTER_PAIRS, RELATIONS, DAL_TABLES, TESTS, GUARDS, UNCALLED, OBJECTS: OBJECTS.length };

const title = "fix(dal): الطبقة الموحدة بقى ما تنطقش باسم السجل ما بيجاوبش — ستة أسماء اتصححت وحارس بيمنعهم";

const msg = `${title}

القياس من ملف الطبقة نفسها مقابل (${AR(RELATIONS)}) علاقة في السجل: (${AR(BEFORE_PAIRS)}) اسم كان بيمرّ في فلاتر وكتابات، منهم (${AR(BEFORE_PHANTOM)}) اسم السجل ما ليهوش وجود — عمود الشركة المختصرة اللي ما اتعملش، وعمود موعد بدء الشغل، وعمود يربط ملف المشترك بحساب الدخول، وعمود الدفع التاني في طلب البيع، وعمودين مين قرر وإمتى في ورقة الموافقة، وجدول حركة كامل للمخزون مالوش وجود. أي فلتر على اسم كده بيرفض برقم حالة معناه «العمود ده مالوش وجود» والكتابة بترفض برقم معناه «الاسم ده مش في القائمة» — والنتيجة سطر فاضي، مش خطأ.

القرار: كل اسم اتصحح للي السجل بيعرفه فعلًا · الشركة بتتعرّف بالنطاق (العمود اللي باب المستأجر بيسأله أصلًا) · الشغل بيتساب باللي اتعمل · قرار الموافقة بيتكتب في عمودين موجودين: مين وافق وإمتى، وسبب الرفض في عمود السبب · طلب البيع بيبعت الأعمدة اللي ليها مكان وبس، وصاحب المشترِك بقى واحد · واللي مالوش مكان اتقال بصوت عالي بدل رحلة مرفوضة: ربط الحساب بالملف (مهمة **١٥٧**) وحركة المخزون (مهمة **١٥٨**).

وبقى في حارس يقرا ملف الطبقة ويطلّع كل اسم في فلتر أو كتابة، ويقارنه بنسخة من أعمدة السجل نفسها — مش من ذاكرة حد · والقياس بعد التصحيح: (${AR(AFTER_PAIRS)}) اسم، منهم (${AR(AFTER_PHANTOM)}) اسم مالوش وجود.

واللي طلع من نفس القياس واتسجل مهمة: (${AR(UNCALLED)}) من (${AR(OBJECTS.length)}) كائن في الطبقة دي مالوش أي مستخدم بره الملف — يعني في طريقين لنفس الجداول، وده اللي خلّى الأسماء الوهمية تعيش (مهمة **١٥٩**).

البوابات: ${AR(TESTS)} اختبار أخضر · تيبشك سليم · بناء كامل · ${AR(GUARDS)} حراس.`;

const prose = msg.replace(/^fix\([a-z]+\): /, "");
const latin = (prose.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => w !== "dal");
if (latin.length) throw new Error("Latin words leaked: " + latin.join(", "));
if (/[0-9]/.test(prose)) throw new Error("Latin digits leaked");
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(msg)) throw new Error("a non-Arabic script leaked");
if (msg.includes("undefined") || msg.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", msg, "utf8");
console.log("measured:", JSON.stringify(T));
console.log(msg);
