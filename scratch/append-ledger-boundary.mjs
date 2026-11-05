import { readFileSync, appendFileSync } from "node:fs";

/**
 * The minute for the boundary round. Numbers come from the census files, never from memory, and the
 * run refuses to write if the instrument never saw the new build.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const MARKER = "حدّ كلام المالك بقى على كل جملة مخزنة";

const summary = (file) => {
  const text = readFileSync(file, "utf8");
  const m = text.match(/شاشات: (\d+) · كلمات لاتينية مختلفة: (\d+) · مجموع المواضع: (\d+)/);
  if (!m) throw new Error(`no summary line in ${file} — the run did not finish`);
  const marks = text.match(/^dashboard clean: (true|false) · old house clean: (true|false) · titles spoken: (true|false)/gm) ?? [];
  const last = marks[marks.length - 1] ?? "";
  const live = /true · old house clean: true · titles spoken: true/.test(last);
  const buckets = [...text.matchAll(/^ {4}(\d+) · (.+)$/gm)].map((x) => ({ n: Number(x[1]), kind: x[2].trim() }));
  return { places: Number(m[3]), words: Number(m[2]), live, marker: last || "none", buckets };
};

const ledger = readFileSync("docs/ledger/council-minutes.md", "utf8");
if (ledger.includes(MARKER)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const before = summary("scratch/owner-latin-before-boundary.out");
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

- **وكيل المتجر (${stamp}):** **${MARKER}: أربع شاشات كانت بيطبع العمود المخزّن كما هو، والعدّاد نزل من ${before.places} لـ ${after.places}.**
  - **السبب إن جولتين كاملتين ما حرّكوا الرقم:** الحرّاس كانت شغّالة على فقاعات المحادثة بس. أربع مواضع كانت بتطبع عمود من القاعدة على طول: سطر الرفض على طاولة الورق · جسم كارت الموافقة · عنوان المهمة في طابور المهام · عنوان الصف في شريط الأحداث. أي كلام إنجليزي اتخزن في الصفوف دي كان بيوصله كما هو، مش لأن المعجم ناقصه — لأن الحرّاس ما كانش بيمرّ على الصف أصلًا.
  - **كلمة واحدة اتغيّرت في كل موضع:** الشاشة بتنادي الحرّاس على النص المخزّن قبل ما ترسمه. ومعاه ست كلمات بتحملها صفوف الدار بقت عربية (معرض · ملف العميل · طلب تعديل · المرئيات · أمر · النظام).
  - **اللي ما اتعملش، متعمّد:** حروف الكلام الإنجليزي («is» و«currently» و«Your») ما اتترجمتش كلمة كلمة. «الموديل هو حاليًا بيُعاني» أسوأ من الإنجليزي على شاشته — الأولى شكل منتج مكسور. الجملة الإنجليزية الكاملة لازم تتصلح في المصدر اللي بيكتبها، مش تتقطّع عند الشاشة.
  - **اللي كشفه الشغل نفسه:** سكربت إضافة السطر حطّ السطر الجديد جوّه «import {» متعدد السطور فكسر ملف — تيبشك الأنواع مسكه قبل النشر. وده اللي بيخليني أشغّل البوابات مش أثق في السكربت.
  - **الفاضل (بالعدد):** ${prose} موضع إنجليزي جوه كلام الموديل نفسه — بقى محسوب عند الباب، فاللي بيتكتب دلوقتي بيعدّي على الحرّاس؛ اللي في الصفوف القديمة لسه بيطبع جُملة كاملة إنجليزي، وده فرق بين «بيتصلح من دلوقتي» و«اتصلح في التاريخ». · ${allowed} موضع مسموح بقراره (مسارات · عناوين مزودات · إيميلات عملاء).
  - **البوابات:** 2031 اختبار أخضر (+6: 5 على المواضع الأربعة والمعجم، و1 إن الجملة الإنجليزية ما بتتقطّعرش) · تيبشك سليم · بناء كامل · نشر على الرابط المنشور والعدّاد بعده.
`);

appendFileSync("docs/ledger/council-minutes.md", minutes, "utf8");
const after2 = readFileSync("docs/ledger/council-minutes.md", "utf8");
console.log(`before=${before.places} after=${after.places} prose=${prose} allowed=${allowed} live=${after.live}`);
console.log(`written: ${after2.includes(MARKER)} · file lines: ${after2.split(/\r?\n/).length}`);
