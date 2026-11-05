import fs from "node:fs";

/**
 * Master-list item 48 after the digits atom: the customer's own digits are measured on the
 * published store. Numerals are generated; the anchor must match exactly once.
 */
const path = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const AI = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const FROM = "الفاضل في نفس البند: الأرقام اللاتينية في أسعار الكتالوج على شاشات العميل (قرار مالك)، وقوالب التقارير اللي لسه بتطالع عناوينها بالإنجليزي.";
const TO = AI(
  "الأرقام كمان بقت بأرقامه: حصر موسّع على 14 عنوان من شاشات العميل (مش أول شاشة — محطات ماشية) لقى 35 سلسلة بأرقام لاتينية (أسعار الكتالوج وشرائح الميزانية وعدّادات الخطوات والصور والدفعات وسنة الفوتر) وبقى صفر، مقاس على المنشور. الفاضل في نفس البند: نموذج التأهيل المتميز لسه إنجليزي بالكامل لعميل عربي (23 سلسلة — خاصية اللغة توصل النموذج وما تُقرأش عنده)، وقوالب التقارير اللي لسه بتطالع عناوينها بالإنجليزي.",
);

const text = fs.readFileSync(path, "utf8");
const n = text.split(FROM).length - 1;
if (n !== 1) throw new Error(`المفتاح طابق ${n} مرة بدل مرة — ما اتكتبش`);
fs.writeFileSync(path, text.replace(FROM, TO), "utf8");
console.log("محفوظ:", fs.readFileSync(path, "utf8").includes("بقى صفر") ? "نعم" : "لا");
