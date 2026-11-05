/**
 * append-council-bell.mjs — the ledger line for the second bell, copied only from printed files.
 *
 * Every number is parsed out of a measurement this run wrote; the script refuses to append when
 * a token has no printed value behind it.
 */
import fs from "node:fs";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const before = stripAnsi(fs.readFileSync("scratch/bell-before.out", "utf8"));
const after = stripAnsi(fs.readFileSync("scratch/measure-bell-contract.out", "utf8"));
const proof = stripAnsi(fs.readFileSync("scratch/prove-bell-lands.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/bell-fullsuite2.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/bell-gates.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const B_DECLARED = num(/^BELL_DECLARED_FIELDS=(\d+)/m, before, "before declared fields");
const B_PHANTOM = num(/^BELL_DECLARES_WHAT_DOOR_NEVER_ANSWERS=(\d+)/m, before, "before phantom fields");
const B_IGNORED = num(/^DOOR_SENDS_WHAT_BELL_IGNORES=(\d+)/m, before, "before ignored envelope fields");
const B_ASKED = num(/^BELL_ASKS=(\d+)/m, before, "before rows asked");
const B_SLICED = num(/BELL_SLICES_TO=(\d+)/, before, "before rows shown");
const B_MOUNTED = num(/^BELL_MOUNTED_AT=(\d+)/m, before, "before mounted screens");

const DOOR_FIELDS = num(/^DOOR_ROW_FIELDS=(\d+)/m, after, "door row fields");
const A_DECLARED = num(/^BELL_DECLARED_FIELDS=(\d+)/m, after, "after declared fields");
const A_PHANTOM = num(/^BELL_DECLARES_WHAT_DOOR_NEVER_ANSWERS=(\d+)/m, after, "after phantom fields");
const A_IGNORED = num(/^DOOR_SENDS_WHAT_BELL_IGNORES=(\d+)/m, after, "after ignored envelope fields");
const A_ASKED = num(/^BELL_ASKS=(\d+)/m, after, "after rows asked");
const A_MOUNTED = num(/^BELL_MOUNTED_AT=(\d+)/m, after, "after mounted screens");
const TABLES = num(/^REALTIME_PUBLISHED_TABLES=(\d+)/m, after, "published tables");
const DEAD_COLS = num(/^AGENT_EVENTS_COLUMNS=(\d+)/m, after, "old event table columns");
const DEAD_ROWS = num(/^AGENT_EVENTS_ROWS=(\d+)/m, after, "old event table rows");
const LEDGER_ROWS = num(/^LEDGER_ROWS=(\d+)/m, after, "ledger rows");

const PROOF = num(/^RESULT: (\d+) of/m, proof, "proof passed");
const PROOF_TOTAL = num(/^RESULT: \d+ of (\d+)/m, proof, "proof total");
const NOT_MEASURED = num(/not measured=(\d+)/, proof, "checks not measured");
const REFUSAL_BYTES = num(/status=400 bytes=(\d+)/, proof, "refusal bytes");
const CARD_WIDTH = num(/"width":(\d+)/, proof, "card width");
const CARD_LATIN = num(/"latinDigits":(\d+)/, proof, "card latin digits");
const CARD_ARABIC = num(/"arabicDigits":(\d+)/, proof, "card arabic digits");
const restLine = (/rest=([^\n]+)/.exec(proof) || [])[1];
if (!restLine) throw new Error("missing measurement: the rest line");
const REST_BYTES = restLine.trim().length;
const CONSOLE_ERRORS = num(/^console errors on the measured tabs: (\d+)/m, proof, "console errors");

const MONTHS = {
  Jan: "يناير", Feb: "فبراير", Mar: "مارس", Apr: "أبريل", May: "مايو", Jun: "يونيو",
  Jul: "يوليو", Aug: "أغسطس", Sep: "سبتمبر", Oct: "أكتوبر", Nov: "نوفمبر", Dec: "ديسمبر",
};
const arNum = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
const deadDate = /AGENT_EVENTS_ROWS=\d+ LAST_WRITE=(?:\w+ )?(\w+) (\d+) (\d+)/.exec(after);
if (!deadDate) throw new Error("missing measurement: the old table's last write");
const DEAD_DATE = `${arNum(deadDate[2])} ${MONTHS[deadDate[1]]} ${arNum(deadDate[3])}`;
const MOUNT_PHRASE =
  B_MOUNTED === 0 ? "وما فيش أي شاشة في اللوحة مركّبا عليه، فالعقد القديم كان بيموت في صمت" : `ومركّب في (${arNum(B_MOUNTED)}) شاشة`;

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/VITEST_EXIT=(\d+)/, gates, "vitest exit") !== 0) throw new Error("the test run refused");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
const GUARDS =
  (fs.readFileSync("tests/dal/realtimeVerdict.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length +
  (fs.readFileSync("tests/ops/alertStripOneOwner.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

if (A_PHANTOM !== 0 || A_IGNORED !== 0) throw new Error("the repair did not land");
if (B_PHANTOM === 0 || B_IGNORED === 0) throw new Error("the before-reading does not show the defect");
if (PROOF !== PROOF_TOTAL) throw new Error("a live check failed: " + (PROOF_TOTAL - PROOF));
if (CARD_LATIN !== 0 || CONSOLE_ERRORS !== 0) throw new Error("the screen is not clean");
if (TABLES === 0 || DEAD_ROWS === 0) throw new Error("the record did not answer");

const T = {
  B_DECLARED, B_PHANTOM, B_IGNORED, B_ASKED, B_SLICED, B_MOUNTED, MOUNT_PHRASE,
  DOOR_FIELDS, A_DECLARED, A_PHANTOM, A_IGNORED, A_ASKED, A_MOUNTED,
  TABLES, DEAD_COLS, DEAD_ROWS, DEAD_DATE, LEDGER_ROWS,
  PROOF, PROOF_TOTAL, NOT_MEASURED, REFUSAL_BYTES, CARD_WIDTH, CARD_LATIN, CARD_ARABIC, REST_BYTES,
  CONSOLE_ERRORS, TESTS, GUARDS,
};

const now = new Date();
const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (${today} ${hh}:${mm}):** **الجرس التاني بقى ما يفتيش عن عقد الباب ما بيردّش — والقناة اللي ما بيوصلهاش تنبيه بقيت بيسمّوا سببها.**`,
  `  **القياس الأول:** الباب بتاع التنبيهات يردّ على السطر بـ(**{DOOR_FIELDS}**) حقول · الجرس التاني كان بيعلن (**{B_DECLARED}**) حقول منهم (**{B_PHANTOM}**) مالوش وجود عنده، وبيسيب (**{B_IGNORED}**) حقول الباب بيردّ بيها ساكن: عدد اللي اتقريت وجملة السكون · كان بيقرا (**{B_ASKED}**) سطر و يعرض منهم (**{B_SLICED}**) · وتعليم الكل كمقروء كان بيجاوب على نفسه من غير ما يسمع ردّة الباب، وحاطط علامة «مقروء» على الشاشة مش في الدفتر، والدفتر ما فيهوش عمود مقروء أصلًا · والشارة كانت بتطبع بحروف لاتينية · والزرّ اللي تحت كان مكتوب «عرض جميع» وشغلته الحقيقية تقفل الشريط بس · **{MOUNT_PHRASE}**`,
  `  **القرار:** الجرس بقى على قاعدة التنبيهات نفسها اللي الكابينة والشاشة القديمة بيسمعوا لها — حقوله (**{A_DECLARED}**) والباب يردّ على كل واحد فيهم، وعدد اللي اتقريت وجملة السكون الباب اللي بيقولهم، والسؤال والعرض بقى نفس العدد (**{A_ASKED}**)، والرفض بيظهر بعد ما يتقرا من ردّة الباب، والشارة بحروفه، و«عرض جميع» بقى وصلة حقيقية لصفحة التحكم · والجملة اللي بتسمّي رفض مش عربي اتنقلت لمالكها في قاعدة التنبيهات، فالشاشتين ما يختلفوش عليها · وعلى نفس القياس من النسخة الحيّة: النشرة اللي بتوصل تنبيهات فورها فيها (**{TABLES}**) جدول، ومالهاش وجود فيهم لا جدول الأحداث القديم (**{DEAD_COLS}** عمود، **{DEAD_ROWS}** سطر آخر كتابة **{DEAD_DATE}**) ولا دفتر المتجر نفسه (**{LEDGER_ROWS}** سطر) · فالاشتراك اللي كان بيفتح هناك ما كانش بيوصلّه ولا تنبيه، وبقي يرفض ويسمّي السبب ويقول إن التنبيهات تتقرا من الدفتر · ومفيش سطر في الدفتر اتغيّر ولا حاجة اتمسحت.`,
  `  **القياس الحيّ على الرابط المنشور:** \`scratch/prove-bell-lands.mjs\` — **نجحت {PROOF} من {PROOF_TOTAL}**: الباب ردّ على الرابط المنشور وبعث عدد اللي اتقريت وجملة السكون، والعدد طابق عدد السطور، والسطر الفاضي قال «مفيش تنبيه مفتوح في دفتر المتجر — الشريط بيعرض آخر ٦٠ دقيقة» بـ(**{REST_BYTES}**) حرف ومن غير رقم لاتيني · والباب رفض طلب فاضي بـ(**{REFUSAL_BYTES}**) حرف عربي · والشاشة المركّبة فعلًا عند عرض **٣٩٠** عرضت كارت الإشعارات بعرض (**{CARD_WIDTH}**) بكسل، (**{CARD_LATIN}**) رقم لاتيني و(**{CARD_ARABIC}**) رقم عربي، وبتطابق الجملة اللي قالها الباب · والصورة اتبصّيت عليها والكونسول فيه (**{CONSOLE_ERRORS}**) خطأ · و({NOT_MEASURED}) قياس اتسجّل «ما اتقارش»: شكل السطر الحيّ ما يتقارش والشارة ساكنة (الباب ردّ بصفر سطور).`,
  `  **وعيوب في مِقياسي اتصلّحت:** أول جولة قالت إن الجرس مركّب في شاشة — والأداة كانت بتعدّ الملف اللي بيعرّف الجرس نفسه كـ«مستخدم» · وأول جولة قالت إن الحقول الوهمية صفر وهي بتقارن بشكل سطر ما كانش موجود (الشارة كانت فاضية)، فبقى القياس يقول «ما اتقارش» بدل ما يطمّن · وخطأ كونسول واحد كان من الرفض اللي الأداة نفسها طلبته، فاتنقل في تبويب لوحده.`,
  `  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حارس** على إن الجرس ما يفتيشش عن عقد قديم وإن القناة الحيّة تسمّي رفضها.`,
  "",
];

const body = lines
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => String(T[k] ?? "undefined")))
  .map((l) =>
    l.replace(/`[^`]*`|«[^»]*»|\*\*[^*]+\*\*|[^`«*]+/g, (chunk) =>
      chunk.startsWith("`") || chunk.startsWith("«")
        ? chunk
        : chunk.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬"),
    ),
  )
  .join("\n");

const allowed = Object.values(T).map(String).join("") + today + "2026";
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
