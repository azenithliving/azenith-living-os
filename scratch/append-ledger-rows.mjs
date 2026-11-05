import { appendFileSync, readFileSync } from "node:fs";

/**
 * The ledger minute for the row pass.
 *
 * Refuses to write unless the proof file carries the marker only this build can print, and takes every
 * number out of the proof itself — the minute states counts, not impressions.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const ledgerPath = "docs/ledger/council-minutes.md";
const MARK = ar("السطر بقى يتارسم سطر");

const ledger = readFileSync(ledgerPath, "utf8");
if (ledger.includes(MARK)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const proof = readFileSync("scratch/proof-rows-final.out", "utf8");
if (!/النسخة الجديدة طلعت/.test(proof) || !/العلامة التالتة/.test(proof)) {
  console.log("REFUSING TO WRITE: a build marker (roll row, or the bracket label) never landed.");
  process.exit(1);
}
const totals = proof.match(/\{"operator":(\d+),"brackets":(\d+),"arrows":(\d+),"bare-latin":(\d+)\}/);
const roll = proof.match(/الدفتر: سطور (\d+) · فيها\.pipe (\d+) · أرقام لاتينية (\d+) · أرقام عربية (\d+)/);
const chat = proof.match(/الشات: جداول (\d+) · خلايا غامقة (\d+) · نجوم (\d+) · أقواس رابط (\d+) · روابط مرسومة (\d+)/);
const errors = proof.match(/أخطاء Console: (\d+)/);
if (!totals || !roll || !chat) {
  console.log("REFUSING TO WRITE: a measured line is missing from the proof file.");
  process.exit(1);
}

const [operator, brackets, arrows, latin] = totals.slice(1).map(Number);
const total = operator + brackets + arrows + latin;
const [, rollRows, rollPipes, rollLatin, rollArabic] = roll.map(Number);
const [, tables, boldCells, stars, linkMarks] = chat.map(Number);
const consoleErrors = errors ? Number(errors[1]) : -1;

const addition = ar(`
- **وكيل المتجر (${new Date().toISOString().slice(0, 16).replace("T", " ")}):** **السطر بقى يتارسم سطر:** العداد اللي قبل كده قال 40 شكل يقلّب الاتجاه، واللي خلّص الجولة دي إنه شغّل العدّاد على الصفوف المخزنة نفسها (scratch/census-math-lines.cts) — فالطلع إن الباقي مش كلمات ناقصة، ده **سطور**: جدول كتبه الموديل، وسطر مكتوب في الكود، وصف في دفتر العملاء. **الإجمالي بقى ${total} — عامل ${operator} · قوس ${brackets} · سهم ${arrows} · كلمة لاتينية ${latin}.**
  - **الجدول كان بيطبع علاماته:** الشات بيقسّم الجدول على الفاصلة من زمان، بس ما كانش بيرسم اللي جوّه الخلايا — فـ«**145ms**» و«[(رابط غير موثق)]()» وصلوله كما هما. الخلايا بقت بتعدّي على نفس رسم النص اللي الكلام العادي بيعدي عليه، والسطر اللي مفيش وراه عنوان بقى كلام مش زرار ما بيوصلش، والجدول بقى يلتفّ على عرضه بدل ما يهرب بره الشاشة. **القياس على شاشته: ${tables} جدول مرسوم، و${stars} نجمة باقية، و${linkMarks} قوس رابط باقي.**
  - **سطر الفخامة كان من الكود مش من الموديل:** كان بيتكتب «Luxury Score مقاسة: 51/100 — p95 = 229ms»، فبقي «درجة الفخامة مقاسة: 51 من 100 — أقصى زمن لفتح الصفحة 229 مللي ثانية»، واسم إشارة البحث بقى عربي في المصدر. واللي بيقول «مش مقاس» بقا بيتقال كده: «N/A» والفراغ «[]» اتترجموا في حدود كلام المالك، والوحمة اللي ملتزقة بالرقم («145ms») بقت «145 مللي ثانية» عشان الرقم لوحده هو اللي بيتحوّل لعربي.
  - **دفتر العملاء:** صف العميل كان «غير محدد | 01002345678» — حاجتين ملزوقين بفاصل جوه سطر عربي، والاسم نفسه مخزّن بالإنجليزي («Living Room (L-shaped sofa / ركنة)»). بقى «غير محدد · ٠١٠٠٢٣٤٥٦٧٨» باسم عربي، **القياس: ${rollRows} سطر مقروء، ${rollPipes} فاصل، ${rollLatin} رقم لاتيني، ${rollArabic} سطر بأرقامه.** وعشان الدفتر شاشة في المتصفح مش سيرفر، قاموس الغرف اتنقل لوحدته الخاصة (lib/cad/room-names.ts) والورقة والدفتر وسطر الحرارة كلهم بيسألوه — مفيش ناسك تاني للغرفة.
  - **مرور تاني على التاريخ بنفس الحدود:** 209 صف من 870 اتغيّر، والقراية من القاعدة قالت إن «N/A» و«ms» مش فاضلين في أي صف.
  - **اللي اتعمل غلط واتصحح في نفس الجولة (مرتين، والاتنين أنا):** أول نسخة من رسم الرابط كانت بيسرق الأقواس اللي جنبه («[تحسين المحتوى] [تحسين السرعة] [تقرير ]()») ويحسبهم رابط واحد — مسكها الدليل الحيّ بعد ما بصّيت على اللقطة، واتصلح باختبار على نفس الشكل المقاس. والتانية: عدّادي كان بيقول «فاصل رابط» لأي «[(» — ولفيت 20 مرة مستني علامة ما ممكنش تظهر، لحد ما بصّيت على الخلية نفسها طلعت «[(رابط غير موثق)]» من غير قوسين فاضيين أصلًا: قوسين حوالين كلمة عربية، مفيش إنجليزي ومفيش تقليبات. **الدرس:** العلامة اللي ما تنجزش إلا بالبناء الجديد لازم تكون حاجة الشاشة بتطبعها فعلًا — وآخر تعديل (ترتيب القراءة قبل التقطيع) مفيش على شاشاته سطر فيه رابط كامل جوّه نافذة المحادثة، فثبتناه باختبار الترتيب وبصفر «](http» مقاس، مش بعلامة.
  - **اللي لسه:** ${operator} سطور عامل كلها جملة «الأكثر مبيعًا» المقوسة («٢× = ٥٤٠٠٠٠ ج.م») — دي معادلة مش حرف، وما ينفعش أغيّر معناها، والحل إنها تتارسم من اليسار لليمين وهي مسجّلة كخطوة جاية · قايمة اقتراحات الموديل بتوصل بين أقواس مربعة («[تحسين المحتوى] [تحسين السرعة]») — كلمة عربية جوه قوسين ما بتقلّبش السطر، بس شكلها آلة، ومسجّلة تتارسم قايمة · ${latin} كلمة لاتينية مالهاش اسم عربي عند الدار لحد دلوقتي (Genesis و Vercel و DB و إيميلات العملاء) · ${consoleErrors < 0 ? "الكونسول ما اتقنش" : "الكونسول في اللقطة الأخيرة: " + consoleErrors + " خطأ"} — وفي لقطة قبلها ظهر «قياس الجودة» و«الإشعارات» بيفشلوا في القراءة؛ نسبتهم لأي شاشة لسه ما اتحسمش لأن أداة القياس نفسها بتعمل تحويل من صفحة الدخول. مسجّل كخطوة جاية.
  - **البوابات:** 2078 اختبار أخضر (كانت 2057 قبل الجولة) — منهم 17 في ملف رسم الجدول والرابط (5 منهم جدُد) و14 في ملف السطر المكتوب والمقياس الناقص والدفتر · تيبشك سليم · بناء كامل · تلات نشرات والقياس بعد كل واحدة · لقطة: scratch/rows-table-390.png و scratch/rows-roll-390.png
`);

appendFileSync(ledgerPath, addition, "utf8");
const after = readFileSync(ledgerPath, "utf8");
console.log(`total=${total} operator=${operator} brackets=${brackets} latin=${latin} tables=${tables} stars=${stars} rollRows=${rollRows} rollPipes=${rollPipes} consoleErrors=${consoleErrors}`);
console.log(`written: ${after.includes(MARK)} · file lines: ${after.split(/\r?\n/).length}`);
