import fs from "node:fs";
import { spawnSync } from "node:child_process";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const before = stripAnsi(fs.readFileSync("scratch/measure-dal-before.out", "utf8"));
const after = stripAnsi(fs.readFileSync("scratch/measure-dal-after.out", "utf8"));
const proof = stripAnsi(fs.readFileSync("scratch/prove-dal-columns.out", "utf8"));
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

const PROOF = num(/RESULT: (\d+) of/m, proof, "proof passed");
const PROOF_TOTAL = num(/^RESULT: \d+ of (\d+)/m, proof, "proof total");
const GHOSTS = num(/names still absent from the record: (\d+) of/m, proof, "ghosts still absent");
const MENTIONS = num(/column names the layer uses: (\d+) mentions/m, proof, "live mentions");
const DISTINCT = num(/column names the layer uses: \d+ mentions · (\d+) distinct/m, proof, "distinct names");
const COCKPIT = num(/^cockpit text at 390px: (\d+)/m, proof, "cockpit chars");
const CUSTOMER = num(/^customer home text at 390px: (\d+)/m, proof, "customer chars");
const JOB_ROWS = num(/^production jobs ordered by the column that exists: (\d+)/m, proof, "job rows");

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/VITEST_EXIT=(\d+)/, gates, "vitest exit") !== 0) throw new Error("the test run refused");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
const GUARDS = (fs.readFileSync("tests/dal/recordColumns.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

const OBJECTS = ["usersDAL", "companiesDAL", "agentProfilesDAL", "agentTasksDAL", "agentConversationsDAL", "agentMessagesDAL", "salesOrdersDAL", "productionJobsDAL", "inventoryDAL", "approvalRequestsDAL", "realtimeDAL"];
const used = OBJECTS.filter((name) => {
  const r = spawnSync("git", ["grep", "-l", "-w", name, "--", "lib", "app", "components", "scripts"], { encoding: "utf8" });
  return r.stdout.split("\n").map((l) => l.trim()).filter((l) => l && l !== "lib/dal/unified-supabase.ts").length > 0;
});
const UNCALLED = OBJECTS.length - used.length;

if (AFTER_PHANTOM !== 0) throw new Error("phantom names remain: " + AFTER_PHANTOM);
if (GHOSTS !== 7) throw new Error("the record gained one of the phantom names — the before measurement needs redoing");
if (DISTINCT !== 51) throw new Error("the live name count moved: " + DISTINCT);

const T = {
  BEFORE_PHANTOM, BEFORE_PAIRS, AFTER_PHANTOM, AFTER_PAIRS, RELATIONS, PROOF, PROOF_TOTAL,
  GHOSTS, MENTIONS, DISTINCT, COCKPIT, CUSTOMER, JOB_ROWS, TESTS, GUARDS, UNCALLED, OBJECT_COUNT: OBJECTS.length,
};

const now = new Date();
const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (${today} ${hh}:${mm}):** **الطبقة الموحدة بقى ما تنطقش باسم السجل ما بيجاوبش — (${BEFORE_PHANTOM}) أسماء اتصححت وحارس بيمنعهم.**`,
  "  **القياس الأول:** ملف الطبقة نفسه اتلفّ واسمه اتقارن بالسجل: (**{RELATIONS}**) علاقة عند السجل، و(**{BEFORE_PAIRS}**) اسم كان بيمرّ في فلاتر وكتابات · منهم (**{BEFORE_PHANTOM}**) أسماء السجل ما ليهوش وجود: عمود الاسم المختصر للشركة، وعمود موعد بدء الشغل، وعمود يربط ملف المشترك بحساب الدخول، وعمود الدفع التاني في طلب البيع، وعمودين مين قرر وإمتى في ورقة الموافقة، وجدول حركة كامل للمخزون · الفلتر على اسم كده بيرفض والكتابة كمان، والنتيجة سطر فاضي — مش خطأ يطلع لمحد.",
  "  **القرار:** كل اسم اتصحح للي السجل بيعرفه · الشركة بتتعرّف بالنطاق، وهو نفس العمود اللي باب المستأجر بيسأله أصلًا · الشغل بيتساب بوقت اللي اتعمل · قرار الموافقة بيتكتب في عمودين موجودين (مين وافق وإمتى) وسبب الرفض في عمود السبب · طلب البيع بيبعت الأعمدة اللي ليها مكان وبس، وصاحب المشترِك بقى واحد · واللي مالوش مكان بقى يتقال بصوت عالي بدل رحلة مرفوضة: ربط الحساب بالملف (مهمة (**١٥٧**)) وحركة المخزون (مهمة (**١٥٨**)).",
  "  **والحارس:** بقى ملف الطبقة اتقرا آليًا، كل اسم في فلتر أو كتابة اتطلّع، واتقارن بنسخة اتعملت من أعمدة السجل نفسه (محفوظة مع الكود، وبتتعمل من القياس مش من كتابة إيد) · أي اسم جديد مالوش مكان في السجل بيقف الاختبار، قبل ما يطلع سطر فاضي على شاشة.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-dal-columns.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: (**{GHOSTS}**) اسم لسه مالهمش وجود في السجل (فاللي اتعمل مش على تخمين إن السجل غيّر حاله) · الطبقة بتستخدم (**{MENTIONS}**) مرة لـ(**{DISTINCT}**) اسم، وكلهم يرد عليهم السجل · الشركة اتعرّفت بالنطاق والسطر طلع · الشغل طلع مرتب بوقت اللي اتعمل (**{JOB_ROWS}**) سطر · كتابة الموافقة (**٥**/ **٥**) وكتابة الطلب (**٩**/ **٩**) أسماء موجودة · الكابينة عند **٣٩٠** (**{COCKPIT}** حرف) وصفحة العميل (**{CUSTOMER}** حرف) الاتنين من غير خطأ كونسول والصورة اتبصّ عليها.",
  "  **اللي طلع من نفس القياس واتسجل مهمة:** (**{UNCALLED}**) من (**{OBJECT_COUNT}**) كائن في الطبقة دي مالوش أي مستخدم بره الملف — يعني قدام نفس الجداول طريقين: واحد بتسأله الأبواب مباشرة وواحد مكتوب وماحدش بيقراه · وده بالتحديد اللي خلّى الأسماء الوهمية تعيش (**{BEFORE_PHANTOM}**) منها في مكان واحد (مهمة (**١٥٩**)).",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حراس** على أسماء الطبقة.",
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
