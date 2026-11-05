import fs from "node:fs";

/**
 * Records the phone-shape atom in the repository ledger.
 *   node scratch/append-ledger-phone-line.mjs
 * Every numeral is written here in Latin digits and converted on the way out, so no count can lose
 * a character to the right-to-left editor the way hand-typed Arabic digits keep doing.
 */
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const AI = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const lines = [
  "",
  `- **وكيل المتجر (${when}):** **سطر الموبايل في الملف الذهبي بقى بنفس الرقم اللي بيتصل بيه.**`,
  "  - **العيب، مقاس بالعين على شاشة المالك المنشورة:** العنوان فوق كان بيقول رقم-الطلب وزرار «اتصل بيه» بينادي على نفس الرقم، لكن السطر اللي تحته تحت عنوان «اللي هتكلّمه» كان بيطبع مفتاح السجل نفسه من غير الصفر: رقم-المفتاح. رقم ما بيوصّلش لو قراه من على الشاشة وطلبه بإيده.",
  "  - **الجذر:** ده نفس عيب الذرة اللي قبلها (رقم المالك اللي ما بيتصلش) بس في وش تاني — الرقم اللي بيتطلب ليه صاحب واحد في الكود، وأي سطر بيصيغه تاني بيخترع شكل. وفيه تالت اتلقى في نفس الطريق: باب قائمة العملاء كان بيركّب الصفر بنفسه بدل ما يسأل صاحب الشكل.",
  "  - **الإصلاح:** السطحين بيسألوا نفس الوحدة — سطر الملف، والباب اللي بيطعم شاشة المبيعات. والحارس في الاختبار بقى يقارن الرقم بحروفه، مش «يكون فيه رقم واحد على الأقل».",
  "  - **البوابات:** 1816 اختبار أخضر · تيبشك سليم · بناء كامل.",
  "  - **الدليل الحيّ على الرابط المنشور (شاشة المالك، عرض 390، قراءة بس من غير ولا صف جديد):** العنوان طلع «عميل من غير اسم · رقم-المفتاح٦ · صفر ورقة» — وسطر الموبايل طلع رقم-المفتاح٦ بنفس الشكل — وزرار الاتصال بينادي +201088887766. وسطر المنطقة اللي اتعملت النهاردة موجود في نفس الملف: «منطقته من كلامه: التجمع». صفر خطأ كونسول. الصورة: scratch/dossier-phone.png.",
  "  - **فرملة للآلة عندي:** أول نسخة من آلة القياس طلعت «سطر الموبايل» غلط — خطفت أول كلمة «الموبايل» في اللوحة، وهي جزء من جملة المساعدة («اكتب آخر رقم في الموبايل أو أول الاسم»). اللي صح إن السطر يتلمّح بالرقم اللي بعده، مش بالكلمة. القياس الغلط كان ممكن يتسجّل دليل.",
  "  - **القاعدة اللي طلعت:** لما أصلح شكل حقيقة واحدة، أبحث عن كل سطح بيصيغها تاني في نفس اليوم — بحث بالقيمة وبالسؤال، مش باسم الدالة. دي المرة الرابعة في أسبوع: المواعيد، أسماء الغرف، كلمة العملة، وشكل الرقم.",
  "",
];

const body = AI(
  lines
    .join("\n")
    // The numbers themselves are typed here, once, in Latin digits — never hand-written in Arabic,
    // because a hand-typed Arabic numeral has lost a character on me three times this week.
    .replaceAll("رقم-الطلب", "01088887766")
    .replaceAll("رقم-المفتاح", "1088887766")
    .replaceAll("دولي", "201088887766"),
);
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !when.includes(r));
if (strays.length) throw new Error(`Latin digits left: ${strays.join(", ")}`);
fs.appendFileSync("docs/ledger/council-minutes.md", body, "utf8");
console.log("appended:", lines.length - 2, "lines");
