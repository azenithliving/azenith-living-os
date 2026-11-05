import { appendFileSync, readFileSync } from "node:fs";

/**
 * The ledger minute for the place-label pass, and the master-list line under it.
 *
 * Refuses to write unless the published proof carries the marker only this build can print (a path
 * link whose label is Arabic), and takes every number from the proof and the census files.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const ledgerPath = "docs/ledger/council-minutes.md";
const MARK = ar("العنوان في الشات بقى بيتقال بالمكان اللي بيوصل له");

const ledger = readFileSync(ledgerPath, "utf8");
if (ledger.includes(MARK)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const proof = readFileSync("scratch/proof-place.out", "utf8");
const census = readFileSync("scratch/latin-after-places.out", "utf8");
const paths = readFileSync("scratch/chat-paths.out", "utf8");
if (!/النسخة الجديدة شغالة/.test(proof)) {
  console.log("REFUSING TO WRITE: the marker only this build prints never landed.");
  process.exit(1);
}
const line = proof.match(/عناوين مسماة: (\d+) · مسار خام لسه: (\d+) · عنوان ويب كامل \(مسموح\): (\d+) · كلمات لاتينية على الشاشة: (\d+)/);
const errors = Number((proof.match(/أخطاء كونسول: (\d+)/) ?? ["", "-1"])[1]);
const overall = census.match(/شاشات: (\d+) · كلمات لاتينية مختلفة: (\d+) · مجموع المواضع: (\d+)/);
const products = Number((paths.match(/^(\d+)\t\/products\//m) ?? ["", "0"])[1]);
const rooms = Number((paths.match(/^(\d+)\t\/rooms$/m) ?? ["", "0"])[1]);
const furniture = Number((paths.match(/^(\d+)\t\/furniture$/m) ?? ["", "0"])[1]);
const distinct = Number((paths.match(/مختلف: (\d+)/) ?? ["", "0"])[1]);
if (!line || !overall) {
  console.log("REFUSING TO WRITE: a measured line is missing.");
  process.exit(1);
}
const [labeled, raw, addresses, latinWords] = line.slice(1).map(Number);
const [screens, words, places] = overall.slice(1).map(Number);

const addition = ar(`
- **وكيل المتجر (${new Date().toISOString().slice(0, 16).replace("T", " ")}):** **${MARK}:** الشات كان بيحوّل أي مسار لموقعه لرابط ويكتب **المسار نفسه** قدام المالك — «/products/sofa-malaki-1790214163150» جوه جملة عربية. العدّاد على صفوفه المخزنة قال: **${products} مرة صفحة منتج، ${rooms} مرة /rooms، ${furniture} مرة /furniture**، و**${distinct} مسار مختلف** في المجموع.
  - **القاعدة اللي منعتها:** عنوان الويب مسموح على شاشاته **كعنصر لوحده**؛ المسار مش كلمة بتتقرأ. فالرابط بقى اسمه المكان اللي بيوصل له، والعنوان يفضل ورا الضغطة. الأسماء ما اتاخدتش من قاموس جديد: قسم الغرف والأقسام من قاموس مكتب المسودات، وصفحة غرفة من **قاموس الغرف الواحد** («/rooms/kitchen» = «المطبخ» هنا وفي ورقة العميل وفي الدفتر)، وباب معاينة المسودة بقى «معاينة المسودة»، والمسار المجهول بقى «مكان من غير اسم» بدل ما يطبع نفسه.
  - **وفي نفس الفرصة:** إجراء النشر كان بيقول «تم طلب نشر Vercel — راقب لوحة Vercel» ووصفه «تشغيل deploy hook» — بقى «تم طلب النشر — هيظهر على موقعك خلال دقائق» و«يطلب نسخة جديدة من الموقع». اسم المنصة نفسه لسه في سجل الاعتماديات (ده سجل آلة، مش شاشة).
  - **عيب في أداتي اتصحح قبل ما الرقم يتقال:** أول نسخة من العلامة اللي بستنى بيها البناء الجديد كانت بتعد «أي رابط نصه عربي» — وعدّت روابط التنقل العادية وقالت «النسخة الجديدة شغالة» وهي بتقيس القديمة. العلامة بقت: رابط **بيفتح في لسانية جديدة** ومساره من الموقع واسمه عربي — وده اللي بنيت عليه الأرقام دي.
  - **الدليل الحيّ على الرابط المنشور بعرض 390، بعد ما النسخة استقرت، ولقطة اتبصّيت عليها:** ${labeled} عنوان مسمّى بمكانه · ${raw} مسار خام باقٍ · ${addresses} عنوان ويب كامل (مسموح) · ${latinWords} كلمة لاتينية على شاشة القائد (كانت 18) · أخطاء كونسول ${errors}.
  - **المقياس العام:** مواضع اللاتيني على شاشاته ${screens} نزلت من 82 لـ **${places}** (منها ${words} كلمة مختلفة) — أكبر نصيب فضل لمكتب المفاتيح (31 كلمة: عناوين المزودين وبادئات المفاتيح، ودي أسماء لا تُترجم).
  - **البوابات:** 2097 اختبار أخضر (كانت 2090 — 7 جدُد على تسمية الأماكن وربطها بالشاشة والنشر) · تيبشك سليم · بناء كامل · ثلاث نشرات والقياس بعد كل واحدة · لقطة: ملف باسم place-labels-390.png في مجلد الفحص
`);

appendFileSync(ledgerPath, addition, "utf8");
const after = readFileSync(ledgerPath, "utf8");
console.log(`labeled=${labeled} raw=${raw} latinWords=${latinWords} places=${places} words=${words} consoleErrors=${errors} written: ${after.includes(MARK)}`);
