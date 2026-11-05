import fs from "node:fs";

/**
 * Master-list item 48, after the owner's own screens were measured and cleared.
 * Numerals are generated; the anchor must match exactly once or nothing is written.
 */
const path = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const AI = (s) => String(s).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const FROM = "الفاضل في نفس البند: قوالب التقارير اللي لسه بتطالع عناوينها بالإنجليزي على شاشات المالك.";
const TO = AI(
  "وشاشات المالك نفسها اتقاست حيًّا على المنشور وخلصت: شاشة المبيعات نزلت من 51 سطر يحمل إنجليزي لـ 3 (سطرين عنوان بريبي — وده مسموح كعنوان مستقل — وسطر الماركة اللي قرارها عندك في البند 31)، والكابينة صفر كلمة وصفر رقم. القاعدة اللي قفلت الباب: قوس لاتيني ورا عربي = تكرار يتمسح، وقوس مالوش عربي قدامه = يتترجم في مكانه. و4 عدّادات كانت لاتينية اتحوّلت لأرقامه، وكارت الاستوديو بقى يحسب وكلاءه بدل ما يصرّح بـ«8» والسرب تسعة.",
);

const text = fs.readFileSync(path, "utf8");
const count = text.split(FROM).length - 1;
if (count !== 1) throw new Error(`المفتاح طابق ${count} مرة بدل مرة — ما اتكتبش`);
fs.writeFileSync(path, text.replace(FROM, TO), "utf8");
console.log("محفوظ:", fs.readFileSync(path, "utf8").includes("وشاشات المالك نفسها") ? "نعم" : "لا");
