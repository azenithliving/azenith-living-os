import fs from "node:fs";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const measure = stripAnsi(fs.readFileSync("scratch/measure-settings-scope-refusal.out", "utf8"));
const proof = stripAnsi(fs.readFileSync("scratch/prove-runtime-read-lands.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/runtime-tests.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/runtime-gates.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const COLUMNS = num(/^site_settings columns in the record: (\d+)/m, measure, "settings columns");
const STATUS = num(/^SCOPED read → status=(\d+)/m, measure, "old scoped status");
const OLD_ROWS = num(/^UNSCOPED read → status=\d+ rows=(\d+)/m, measure, "old unscoped rows");

const PROOF = num(/RESULT: (\d+) of/m, proof, "proof passed");
const PROOF_TOTAL = num(/^RESULT: \d+ of (\d+)/m, proof, "proof total");
const NEW_STATUS = num(/^the one query → status=(\d+)/m, proof, "new query status");
const NEW_ROWS = num(/^the one query → status=\d+ rows: (\d+)/m, proof, "new query rows");
const REFUSED_STATUS = num(/^the old tenant filter → status: (\d+)/m, proof, "refused status");
const BYTES = num(/^served home page bytes: (\d+)/m, proof, "served bytes");
const CHARS = num(/^home page text at 390px: (\d+)/m, proof, "home chars");
const THEME_KEYS = num(/^record theme keys: (\d+)/m, proof, "theme keys");
const AD_ON = /record ad switches: adsenseEnabled=(\w+)/.exec(proof)?.[1];
const BRAND = (proof.match(/shell inline brand \/ computed brand: \w+ \/ (#\w+)/) ?? [])[1] ?? "";

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/VITEST_EXIT=(\d+)/, gates, "vitest exit") !== 0) throw new Error("the test run refused");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
const GUARDS = (fs.readFileSync("tests/settings/runtimeRead.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

if (NEW_ROWS !== OLD_ROWS || NEW_STATUS !== 200) throw new Error("the single query does not deliver what the old pair did");
if (REFUSED_STATUS !== STATUS) throw new Error("the refused filter answers differently now");
if (!BRAND.startsWith("#")) throw new Error("the instrument did not read the computed brand color");

const T = {
  COLUMNS, STATUS, OLD_ROWS, PROOF, PROOF_TOTAL, NEW_STATUS, NEW_ROWS, REFUSED_STATUS,
  BYTES, CHARS, THEME_KEYS, BRAND, TESTS, GUARDS,
};

const now = new Date();
const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (${today} ${hh}:${mm}):** **قراية ثيم الموقع بقت رحلة واحدة — والفلتر اللي السجل بيرفضه اتشال من أول صفحة.**`,
  "  **القياس الأول:** جدول الإعدادات بيجاوب على (**{COLUMNS}**) عمود بس (المفتاح، القيمة، آخر تعديل، مين عدّل) ومفيش فيهم عمود للشركة · السؤال القديم كان بيطرح فلتر على العمود ده أول كل صفحة، والقياس على الرابط المنشور قال: بيرفض برقم حالة (**{STATUS}**) · وبعده الكود كان بيقرا نفس السطور من غير فلتر وياخد (**{OLD_ROWS}**) سطر على أي حال — يعني رحلتين ضائعتين في أول كل صفحة، واحدة تسأل عن الشركة وواحدة مرفوضة، وفلتر التصنيف كان بيوهم إن في فصل بين الشركات وهو ما بيفصلش حاجة.",
  "  **القرار:** الفلتر الوهمي اتشال والقراية بقت (**{NEW_STATUS}**) بردها (**{NEW_ROWS}**) سطر في رحلة واحدة · ولو السجل رفض، العيب بيتقال بصوت عالي والصفحة تفضل شغالة بالافتراضي، بدل قراية تانية في الخفاء تسدّ مكانها · والفصل بين الشركات في الإعدادات قرار في هيكل السجل (عمود جديد وتعبية السطور القديمة) مش فلتر يتكتب على التخمين، فاتسجل.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-runtime-read-lands.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: السجل لسه بيرفض نفس الفلتر القديم برقم حالة (**{REFUSED_STATUS}**) فالشوف اتعمل على حقيقة مش على تخمين · الصفحة بتتقدّم بـ(**{BYTES}**) حرف و(**{CHARS}**) حرف مقروء عند عرض **٣٩٠** من غير خطأ كونسول والصورة اتبصّ عليها · ولا نص رفض تسرّب في الرد · والمكتب ما اختراعش ألوان: سجل المتجر فيه (**{THEME_KEYS}**) مفتاح ثيم، فالصفحة ما بتحمّلش أي لون من السجل، واللون اللي بيوصل للمتصفح `({BRAND})` جاي من ورقة التنسيقات نفسها · والإعلانات مطفية في السجل فالصفحة ما بتحمّلش سكربت إعلانات · والفصل ده اتعمل بتسجيل الطرفين مش بتسجيل واحد، عشان الشيك ما ينجحش وهو فاضي.",
  "  **اللي طلع من نفس القياس واتسجل مهمة:** سطر الثيم فاضي من غير كاتب — الموقع بألوان ورقة التنسيقات مش بألوان المالك · يبقى له محرّر حقيقي في الكابينة يكتب السطر، أو يتقال في السجل إن الألوان بتاعة الورقة ويتشال التحكم الفاضي من على مكتبه · ومفيش سطر بيت مسح غير بكلمة صريحة منه (مهمة **١٥٥**).",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حراس** على القراية نفسها: عدد الرحلات، ومنع اسم الشركة، والرفض مسموع.",
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

const allowed = Object.values(T).map(String).join("") + today + BRAND.replace("#", "");
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
console.log("المقاس:", JSON.stringify(T), "adSwitch=" + String(AD_ON), "today=" + today);
