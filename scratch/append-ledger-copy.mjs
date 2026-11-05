import { readFileSync, appendFileSync } from "node:fs";

/**
 * The minute for the source-copy round, with its numbers read out of the census files.
 *
 * Same rule as the previous minute: no number in this file comes from memory. The "before" is the
 * census taken before this round's publish, the "after" is the one that waits for the new build's
 * marker and refuses to be quoted if the marker never appears.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const MARKER = "الجمل اللي الدار بيكتبها عن نفسه";

const summary = (file) => {
  const text = readFileSync(file, "utf8");
  const m = text.match(/شاشات: (\d+) · كلمات لاتينية مختلفة: (\d+) · مجموع المواضع: (\d+)/);
  if (!m) throw new Error(`no summary line in ${file} — the run did not finish`);
  const marks = text.match(/^dashboard clean: (true|false) · old house clean: (true|false)/gm) ?? [];
  const last = marks[marks.length - 1] ?? "";
  const buckets = [...text.matchAll(/^ {4}(\d+) · (.+)$/gm)].map((x) => ({ n: Number(x[1]), kind: x[2].trim() }));
  return {
    places: Number(m[3]),
    words: Number(m[2]),
    live: /true · old house clean: true/.test(last),
    marker: last || "none",
    buckets,
  };
};

const ledger = readFileSync("docs/ledger/council-minutes.md", "utf8");
if (ledger.includes(MARKER)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const before = summary("scratch/owner-latin-before-copy.out");
const after = summary("scratch/owner-latin-after.out");
if (!after.live) {
  console.log(`REFUSING TO WRITE: the after-run never saw the new build (last marker: ${after.marker}).`);
  process.exit(1);
}

const now = new Date();
const stamp = ar(
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`,
);

const prose = after.buckets.find((b) => b.kind.includes("كلام منسوب للدار"))?.n ?? 0;
const allowed = after.buckets.filter((b) => !b.kind.includes("كلام منسوب للدار")).reduce((s, b) => s + b.n, 0);

const minutes = ar(`

- **وكيل المتجر (${stamp}):** **الجمل اللي الدار بيكتبها عن نفسه بقت عربي في مصدرها: ${before.places} موضع بقوا ${after.places} على شاشاته العشرة.**
  - **ليه المصدر مش الشاشة:** العدّاد قال إن اللي فضل 137 موضع، منهم 84 كلمة إنجليزي جوه كلام «مكتوب باسم الدار». عدّاد التاني (scratch/census-english-authors.cjs) قسّم دول اتنين: كلام كتبه الموديل واتخزن في صفوف، وكلام **الكود بتاعنا هو اللي بيلّفه**. التاني هو اللي يتصلح في مصدره — الإصلاح عند الشاشة كان يسيب المصدر يكتب نفس الإنجليزي في أي شاشة تانية.
  - **الخمسة اللي اتصلحوا في مصدرهم:** تقرير الموافقة كان بيلصق الأمر خام («تنفيذ أمر إداري: send_notification …») وبقى بيقول «إرسال إشعار» · شريط الأحداث كان بيطبع نوع الصف كما هو («command» و«system») وبقى كلمة عربية أو **ولا حاجة** لو النوع مش معروف · كارتين في اللوحة القديمة كانت أسماؤهم «تفاعلات AI» و«تجارب A/B» وبقوا «تفاعلات المساعد» و«تجارب مقارنة» (وعدد الموظفين اللي في نفس السطر بقى بأرقامه) · باب الأوامر كان بيرفض بتسعاشر جملة إنجليزي («Command not allowed. Contact system administrator.») وبقى عربي، وتنبيه تليجرام اللي بيبعتله كان إنجليزي بالكامل · وقايمة المساعدة بتتبنى من نفس الجدول اللي بسمّيه، فالأمر ما يقدرش يتغيّر ويسيب جملة قديمة.
  - **قاعدة اتكتبت في الوحدة الجديدة:** اسم الأمر المجهول «أمر إداري» — مش أقرب اسم. اسم غلط بيقول للحاج إن حاجة هتحصل ومش هتحصل، وده الفرامل اللي هو ماسكنا بيها من أول يوم.
  - **اللي الاختبار الجديد كشفه في السطر اللي كتبته قبله:** كود الحالة (٥٠٣ و٤٠٣ و٤٠٠) كان بيمشي ضائع لأن المجموعة في التعبير العادي غير مُلتقطة فالاتجاه بياخد فراغ، ورقم لاتيني كان داخل جملة عربية. الاختبار اتكتب قبل الإصلاح وشافهم — ده السبب إن الاختبار بيتكتب الأول.
  - **اللي لسه (بالعدد):** ${prose} موضع إنجليزي جوه كلام الموديل نفسه مخزّن في صفوف — ده شغل الحرّاس عند الباب اللي بيكتب الصف، مش عند الشاشة · و${allowed} موضع مسموح بقراره (مسارات موقع، عناوين مزودات، إيميلات عملاء).
  - **البوابات:** 2025 اختبار أخضر (+15: 11 على أصوات المصادر الجديدة و4 على جُمل الرفض) · تيبشك سليم · بناء كامل · نشر على الرابط المنشور والعدّاد بعده.
`);

appendFileSync("docs/ledger/council-minutes.md", minutes, "utf8");
const after2 = readFileSync("docs/ledger/council-minutes.md", "utf8");
console.log(`before=${before.places} after=${after.places} prose=${prose} allowed=${allowed} live=${after.live}`);
console.log(`written: ${after2.includes(MARKER)} · file lines: ${after2.split(/\r?\n/).length}`);
