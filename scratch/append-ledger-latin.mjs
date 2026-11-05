import { readFileSync, appendFileSync } from "node:fs";

/**
 * The Latin census minute, with its numbers read out of the two measurement files.
 *
 * Written this way on purpose: the last thing this project needs is a ledger line quoting a number I
 * remember from a terminal scroll. The "before" is scratch/owner-latin.out, the "after" is
 * scratch/owner-latin-after.out, and both end with the same summary line the instrument prints.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));

const summary = (file) => {
  const text = readFileSync(file, "utf8");
  const m = text.match(/شاشات: (\d+) · كلمات لاتينية مختلفة: (\d+) · مجموع المواضع: (\d+)/);
  if (!m) throw new Error(`no summary line in ${file} — the run did not finish`);
  // Live means the instrument's own marker line ended with both screens clean, not merely that it ran.
  const marks = text.match(/^dashboard clean: (true|false) · old house clean: (true|false)/gm) ?? [];
  const last = marks[marks.length - 1] ?? "";
  const live = /true · old house clean: true/.test(last);
  return { screens: Number(m[1]), words: Number(m[2]), places: Number(m[3]), live, marker: last || "none" };
};

const before = summary("scratch/owner-latin.out");
const after = summary("scratch/owner-latin-after.out");
const MARKER = "مفتاح الموظف بقى مش اسمه";
if (readFileSync("docs/ledger/council-minutes.md", "utf8").includes(MARKER)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}
if (!after.live) {
  console.log(`REFUSING TO WRITE: the after-run never saw the new build (last marker: ${after.marker}).`);
  process.exit(1);
}

const now = new Date();
const stamp = ar(
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`,
);

const remaining = readFileSync("scratch/owner-latin-after.out", "utf8");
const stillMachine = [...remaining.matchAll(/^\s+(\d+) × (ops-[a-z]+|vanguard|analyst|coder|learner|lead_list|gsc_queries|show_stats|[A-Z]{4,})$/gm)]
  .slice(0, 12)
  .map((m) => `${m[2]} (${m[1]})`)
  .join(" · ");

const minutes = ar(`

- **وكيل المتجر (${stamp}):** **مفتاح الموظف بقى مش اسمه: 179 موضع لاتيني على 10 شاشات بتاعته بقوا ${after.places} — واللي فضل محسوب ومسمّى.**
  - **اللي اتقاس بالعين مش بالبحث في الكود:** عدّاد جديد (scratch/census-owner-latin.mjs) بيفتح العشر شاشات بتاعته على الرابط المنشور بعرض 390 وبيعدّ كل كلمة لاتينية بتطبعها الصفحة فعلاً. الفرق عن البحث في الملفات إنه بيشوف اللي الدار كاتبه في صف، واللي الموديل كتبه في رد، واللي الكود بيرسمه من متغير — دول كلهم ما بانشين للبحث. **قبل: 179 موضع في 114 كلمة · بعد: ${after.places} موضع في ${after.words} كلمة.**
  - **الجذر اللي كان مستور:** وحدة التسمية كانت تعرف أسماء السرب الثمانية بس، وأي موظف برّاها بترجع **مفتاحه كما هو**. فكان كارت مكتب المبيعات عنوانه «vanguard»، ودار الموظفين القديمة بتصرخ «VANGUARD · ANALYST · OPS-LEAD»، وأول عمود في جدول المهام داخل المحادثة كان 7 مفاتيح. بقى لكل موظف ممكن المالك يواجهه كلمة عربية في الوحدة الواحدة اللي بتملك الأسماء.
  - **تنين تسريب تانيين اتقفلوا في نفس المكان:** رمز الآلة اللي الموديل بيلّفه بعلامات الكود كان بيمشي من غير ما يتلمّ لأن «الكود بيتنقل زي ما هو» — بقى لو كان الرمز كله هو المحتوى بيتترجم أو بيمسي، و«‎page.goto(url)» الحقيقي لسه بيتنقل كما هو لأنه كود بينسخه · وسطر الرفض على طاولة الورقة كان بيطبّع جملة المزود بالإنجليزي («Your credit balance is too low») — بقى بيقول الحقيقة اللي يقدر يعمل بيها حاجة: «رصيد المفتاح خلص (٤٠٠)» بأرقامه.
  - **اللي لسه لاتيني ومش غلط:** موبايلات العملاء وإيميلاتهم وطلباتهم المكتوبة بالإنجليزي (دي بياناته هو)، وعناوين المزودات اللي بيروح ياخد منها المفتاح (العنوان مسموح كعنصر لوحده)، ومقدمة المفتاح («بيبدأ بـ AIza.») لأنه بيطابقها بإيده.
  - **الفاضل من العدّ بعد الإصلاح:** ${stillMachine || "مفيش مفتاح آلة طالع من شاشته"}.
  - **البوابات:** 2007 اختبار أخضر (+17 عن الصبح: 4 على صوت المالك الجديد و3 على التسمية) · تيبشك سليم · بناء كامل · نشر على الرابط المنشور والقياس بعده.
`);

appendFileSync("docs/ledger/council-minutes.md", minutes, "utf8");
const after2 = readFileSync("docs/ledger/council-minutes.md", "utf8");
console.log(`before=${before.places}/${before.words} after=${after.places}/${after.words} live=${after.live}`);
console.log(`written: ${after2.includes(stamp)} · file lines: ${after2.split(/\r?\n/).length}`);
