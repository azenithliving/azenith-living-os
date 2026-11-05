import { appendFileSync, readFileSync } from "node:fs";

/**
 * The ledger minute for the equation pass.
 *
 * Refuses to write unless the published proof carries this build's marker, reads every number out of
 * the two measurement files rather than restating them, and quotes what is left over from the proof's
 * own samples — a remainder I have not seen is a remainder I cannot describe.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const ledgerPath = "docs/ledger/council-minutes.md";
const MARK = ar("المعادلة جوه سطر عربي بقى ليها اتجاهها");

const ledger = readFileSync(ledgerPath, "utf8");
if (ledger.includes(MARK)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const proof = readFileSync("scratch/proof-math.out", "utf8");
const order = readFileSync("scratch/math-order.out", "utf8");
const census = readFileSync("scratch/line-shapes.out", "utf8");
if (!/النسخة الجديدة شغالة/.test(proof)) {
  console.log("REFUSING TO WRITE: this build's marker never landed on his screens.");
  process.exit(1);
}
const orderVerdict = /نتيجة: كل مجموعة بتبدأ من الشمال وتخلص على اليمين/.test(order)
  ? "الترتيب مقاس بمكان الحروف على الشاشة: أول حرف شمال آخر حرف"
  : "الترتيب لسه مقلوب على الشاشة";
const orderCount = Number((order.match(/مجاميع على الشاشة: (\d+)/) ?? ["", "0"])[1]);
const orderWrong = Number((order.match(/نتيجة: (\d+) مجموعة لسه بتتقرأ من اليمين/) ?? ["", "0"])[1]);
const totals = proof.match(/معامل (\d+) · منه مقلوب (\d+) · مجاميع مرسومة (\d+) · قايم مرسومة (\d+)/);
const lines = census.match(/سطور فيها معادلة: (\d+) · عدد المعادلات: (\d+)/);
const lists = census.match(/سطور فيها قايمة أقواس: (\d+)/);
if (!totals || !lines || !lists) {
  console.log("REFUSING TO WRITE: a measured line is missing.");
  process.exit(1);
}
const [ops, flipped, drawn, drawnLists] = totals.slice(1).map(Number);
const [eqLines, eqRuns] = lines.slice(1).map(Number);
const bracketLines = Number(lists[1]);

const leftover = proof
  .split(/\r?\n/)
  .filter((l) => /^\s*\/admin/.test(l) && /[=×]/.test(l))
  .slice(0, 2)
  .map((l) => l.trim().replace(/\s+\|\s+/, " — ").slice(0, 110));

const remainder = flipped
  ? `**اللي لسه مقلوب: ${flipped} من ${ops}.** ${leftover.length ? leftover.map((l) => `«${l}»`).join(" · ") : "اللقطة ما طبعتش العيّنة"} — مواضع بتطبعها شاشة ما عدّتش على نفس الرسم، والخطوة الجاية بتتحدّد من هنا مش من انطباعي.`
  : `**اللي لسه مقلوب: صفر** من ${ops} موضع فيه علامة، على شاشاته الخمس المقاسة.`;

const addition = ar(`
- **وكيل المتجر (${new Date().toISOString().slice(0, 16).replace("T", " ")}):** **${MARK}:** العدّادين اللي فاتوا كانوا بيعدّوا **الحرف** («فيه علامة يساوي أو ضرب؟») وكفاية. القياس الصح قال إن العيب مش الحرف، العيب **الترتيب**: في سطر عربي كل رقم بيحتفظ بترتيبه، والعلامة اللي بين رقمين ما ليهاش اتجاه، فبتاخد اتجاه الجملة و**الطرفين بيتبادلوا** — «٢× = ٥٤٠٠» بتظهر مقلوبة.
  - **اللي اتقاس قبل التنفيذ:** تشغيل حدود كلام المالك على 870 صف مخزنة (scratch/census-line-shapes.cts): **${eqRuns} معادلة في ${eqLines} سطر** — أغلبها سطر «الأكثر مبيعًا» («٢× = ٥٤٠٠٠٠ ج.م») و«٥١/١٠٠» و«p95 = ٢٣٧ مللي ثانية» — و**${bracketLines} سطر** كله قايمة اقتراحات مكتوبة بين أقواس («[افتح التقرير] [راجع السجل] [طبّق التحسينات]»).
  - **اللي اتعمل:** المجاميع **ما اتغيّرش حرف منها** — كل مجموعة أرقام وعلامة بقت بتتاخد في اتجاهها الخاص، نفس اللي بيحصل للرابط والأمر اللي بينسخه. والقايمة اللي بين الأقواس بقت **قايمة مرسومة** بنقط والكلمة زي ما هي. والسطح التالت اللي كان بيطبع الصف كما هو — سطر الكارت في مصفوفة القيادة — بقى بيعدي على نفس الرسم.
  - **إصلاحى الأول اتكذّب بقياسه، وده مسجّل:** أول نسخة عطت المجموعة \`dir="ltr"\` والعدّاد قال «اتجاهها شمال-يمين» — لكن لما قِست **مكان الحروف على الشاشة** طلعت لسه بتتقرأ من اليمين: عزل المجموعة ما بيمنعش الأرقام العربية الهندية إنها تُحسب بجملة اللي حواليها. جرّبت 7 طرق على نفس الصفحة في نفس السطر (scratch/which-css-orders-math.mjs): العادي، \`direction: ltr\`، خاصية \`dir\`، \`isolate\`، \`plaintext\`، و\`inline-block\` — كلهم مقلوب. الطريقة الوحيدة اللي رجّعت «أول حرف على الشمال» هي \`isolate-override\`، ودي اللي اتحطّت، وفيه حارس في الاختبارات بيمنع إنها ترجع لاتجاه بس.
  - **الحراسة اللي منعت المبالغة:** التاريخ («٢٠٢-٠٦-٢٨») ورقم الموبايل **ما بيتلمّوش** — مفيش شكل مقاس فيهم فيه علامة عملية، فاللفّ كان حكم من غير قياس. وكلمة عربية بين رقمين ببتقطع المجموعة، فـ«كنبة ٣ مقاعد + ٢ فوتيه» ما بتتحولش لحساب.
  - **الدليل الحيّ على الرابط المنشور بعرض 390:** ${drawn} مجموعة مرسومة · ${drawnLists} قايمة ات رسمت · ${ops} موضع فيه علامة · ${orderCount} مجموعة اتقاس ترتيبها بمكان الحروف: ${orderVerdict}${orderWrong ? ` (${orderWrong} لسه مقلوبة)` : ""}.
  - ${remainder}
  - **البوابات:** 2090 اختبار أخضر (كانت 2080 — 10 جدُد: ترتيب القراءة قبل التقطيع، والمعادلات، والقايم، وسطر الكارت) · تيبشك سليم · بناء كامل · نشرة والقياس بعدها · لقطة: ملف باسم math-screen-390.png في مجلد الفحص
`);

appendFileSync(ledgerPath, addition, "utf8");
const after = readFileSync(ledgerPath, "utf8");
console.log(`ops=${ops} flipped=${flipped} drawn=${drawn} lists=${drawnLists} eqRuns=${eqRuns} eqLines=${eqLines} leftoverSamples=${leftover.length} written: ${after.includes(MARK)}`);
