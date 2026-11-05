import fs from "node:fs";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const proof = stripAnsi(fs.readFileSync("scratch/prove-census-answers.out", "utf8"));
const blind = stripAnsi(fs.readFileSync("scratch/measure-discovery-blind.out", "utf8"));
const kinds = stripAnsi(fs.readFileSync("scratch/measure-relation-kinds.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/census-tests.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/census-gates.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const PROOF = num(/RESULT: (\d+) of/m, proof, "proof passed");
const PROOF_TOTAL = num(/^RESULT: \d+ of (\d+)/m, proof, "proof total");
const BASE = num(/the record's relations: base=(\d+)/, proof, "base tables");
const VIEWS = num(/the record's relations: base=\d+ views=(\d+)/, proof, "views");
const WORKING = num(/working \(census rule\)=(\d+)/, proof, "working tables");
const SKIPPED = num(/skipped=(\d+)/, proof, "skipped relations");
const LISTED = num(/^tables in the picture: (\d+)/m, proof, "listed tables");
const SETTINGS_TRUTH = num(/^the record's settings rows: (\d+)/m, proof, "settings truth");
const SETTINGS_PICTURE = num(/^settings in the picture: (\d+)/m, proof, "settings picture");
const RULES_TRUTH = num(/^the record's rules: (\d+)/m, proof, "rules truth");
const RULES_PICTURE = num(/^rules in the picture: (\d+)/m, proof, "rules picture");
const STRANGER = num(/a stranger's snapshot: status=(\d+)/, proof, "stranger status");
const CHARS = num(/^cockpit text length at 390px: (\d+)/m, proof, "cockpit chars");
const TOKENS = num(/^credential fields found in telegram_config: (\d+)/m, proof, "credential fields");
const DIGITS = num(/^latin digits anywhere in the summary: (\d+)/m, proof, "latin digits in the summary");
const PAYLOAD = num(/^payload size of the picture: (\d+)/m, proof, "payload size");

// The blindness, measured before the fix.
const PROBE_STATUS = num(/^== old existence probe → status=(\d+)/m, blind, "old probe status");
const DEFINITIONS = num(/INVENTORY definitions=(\d+)/m, blind, "inventory definitions");
const RULE_COLUMNS = num(/^   columns\((\d+)\): id, company_id/m, blind, "rule columns");

// The two counts the record itself answers, independent of the door.
const DOC_RELATIONS = num(/^root document relations: (\d+)/m, kinds, "document relations");
const ONLY_IN_DOC = (kinds.match(/in the document, not a base table and not a view: ([^\n]*)/) ?? [])[1].trim().length;
const DOC_MISSING_BASE = (kinds.match(/base tables the document does not expose: ([^\n]*)/) ?? [])[1].trim().length;

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/VITEST_EXIT=(\d+)/, gates, "vitest exit") !== 0) throw new Error("the test run refused");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
const GUARDS =
  (fs.readFileSync("tests/ops/recordInventory.test.ts", "utf8").match(/^\s*it\(|^\s*it\.each/gm) ?? []).length +
  (fs.readFileSync("tests/settings/facts.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

// The registry census vs the table's own rows — the finding that became a task.
const facts = fs.readFileSync("lib/settings/facts.ts", "utf8");
const NAMED = (facts.match(/^\s*(\{ )?key: "/gm) ?? []).length;

if (LISTED !== WORKING + VIEWS) throw new Error("the picture is not the record's working set");
if (SETTINGS_PICTURE !== SETTINGS_TRUTH) throw new Error("settings count drifted");
if (RULES_PICTURE !== RULES_TRUTH) throw new Error("rules count drifted");
if (TOKENS === 0) throw new Error("the instrument found no credential to test for — the leak check proves nothing");
if (ONLY_IN_DOC !== 0 || DOC_MISSING_BASE !== 0) throw new Error("the door's document and the record disagree");

const UNNAMED = SETTINGS_TRUTH - NAMED;

const T = {
  PROOF, PROOF_TOTAL, BASE, VIEWS, WORKING, SKIPPED, LISTED,
  SETTINGS_TRUTH, SETTINGS_PICTURE, RULES_TRUTH, RULES_PICTURE,
  STRANGER, CHARS, TOKENS, DIGITS, PAYLOAD,
  PROBE_STATUS, DEFINITIONS, RULE_COLUMNS, DOC_RELATIONS,
  TESTS, GUARDS, NAMED, UNNAMED,
};

// The stamp comes from the clock, never copied from an older line.
const now = new Date();
const Y = now.getUTCFullYear();
const MO = String(now.getUTCMonth() + 1).padStart(2, "0");
const D = String(now.getUTCDate()).padStart(2, "0");
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");
const today = `${Y}-${MO}-${D}`;

const lines = [
  "",
  `- **الوكيل (${today} ${hh}:${mm}):** **محرك الاستكشاف بقى بيشوف المتجر فعلًا — والجرد اتحوّل لوثيقة السجل نفسه.**`,
  "  **القياس الأول:** المحرك كان يسأل السجل «الجدول موجود؟» من شاشة نظام داخلية، والسجل ما بيردش على شاشات النظام · اتقاس على الرابط المنشور: السؤال بيرفض برقم حالة (**{PROBE_STATUS}**) وبرقم خطأ معناه «ماليش وجود» · فالنتيجة كانت دايمًا **صفر** جدول و**صفر** إعداد و**صفر** قاعدة، والسجل نفسه بيقول إن عنده (**{DOC_RELATIONS}**) علاقة، وفيها (**{SETTINGS_TRUTH}**) سطر إعدادات و(**{RULES_TRUTH}**) قاعدة — يعني كل موظف ذكي كان بيبني صورته للمتجر على إنه فاضي، وأي سؤال يتقاله يجاوبه «المتجر ما فيهوش حاجة».",
  "  **وكان في عمى تاني وراه:** قراءة القواعد كانت تطلب اسمين مالهمش وجود عند السجل من بين (**{RULE_COLUMNS}**) عمود حقيقيين — فلو حتى السؤال الأول نجح، كانت القراءة تترفض.",
  "  **القرار:** الجرد بقى من وثيقة السجل نفسها في رحلة واحدة تجيب كل جدول وأعماده · القراءتان التانيان بطلبوا الأسماء اللي السجل بيعرفها بس، والعلم بقى من صاحبه الوحيد · وعدد الصفوف اتسجل «مش متقيس» بدل صفر — لأن صفر كان بيخلي جار التنبيه يصرخ إن الجداول كلها فاضية.",
  "  **وقرار في نص الطريق:** النسخ القديمة اللي اسمها بيبدأ بنقطة سفلى (**{SKIPPED}**) ما اتحذفتش وما اتلمتش في الصمت — اتعدّت لوحدها وقال الملخص للوكلاء «دي مستثناة من العدّ»، عشان رقم (**{LISTED}**) ما يبينش قدام (**{DOC_RELATIONS}**) كأن فيهم ضايعين.",
  "  **والسر ما طلعش مع الجرد:** أول ما العمى اترفع، مفتاح بوت التنبيه كان هيطلع لوحده في صورة الوكلاء وفي الرد اللي بيشيل (**{PAYLOAD}**) حرف ويطلع لباب الإدارة · القيمة بقت محجوبة، واللي بيقول «أي مفتاح ده سر» بقى صاحب واحد في سجل الحقائق نفسه، والباب القديم رجع يسأله.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-census-answers.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: الجرد عدّ (**{LISTED}**) علاقة والسجل من جواه قال (**{WORKING}**) شغال + (**{VIEWS}**) شاشة — نفس العدد ونفس الأسماء حرف بحرف · الإعدادات (**{SETTINGS_PICTURE}**) من (**{SETTINGS_TRUTH}**) والقاعدة (**{RULES_PICTURE}**) من (**{RULES_TRUTH}**) · **({TOKENS})** حقل سر اتلفّت على الرد كله وما طلعش ولا حرف · الغريب بياخد (**{STRANGER}**) · والكابينة عند عرض **٣٩٠** (**{CHARS}** حرف) من غير خطأ كونسول والصورة اتبصّ عليها · الأداة ما كتبتش ولا سطر (قراءة بس)، ورفضت تكتب سجلها لو لقت فيه مفتاح.",
  "  **اللي طلع من نفس القياس واتسجل مهمة:** سجل الحقائق بيسمي (**{NAMED}**) مفتاح باسم عربي والجدول فيه (**{SETTINGS_TRUTH}**) — يعني (**{UNNAMED}**) مفاتيح اتكتبت بعده (رقم الشغل، قرار التحقق بخطوتين، آخر نسخة ليلية) مالهاش اسم، ومهمة (**١٥٣**) اتفتحت بيهم · وفيه (**{DIGITS}**) رقم لاتيني في الملخص كله، طلع جوه اسم جدول مش جوه عدد، فاتسجّل زي ما هو.",
  "  **وعيبان في مِقياسي نفسه اتصلّحوا في نفس الرحلة:** الأول كان بيقارن عدد الصورة بعدد الجدول من غير شاشات (**{VIEWS}**) فكان بيقول «الجرد ناقص» وهو تمام، والتاني كان بيفتش على السر في أول قصاصة من الرد مش في الرد كله — يعني كان بيقول «مفيش تسريب» من غير ما يشوف · الاتنين اتظبطوا والقياس اتعاد من أوله.",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حراس** على الجرد وعلى إن السر ما يطلعش.",
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
