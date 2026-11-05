import fs from "node:fs";

/**
 * Item 48 of the master list, re-measured after the customer pages were walked station by station.
 * Every Arabic-Indic numeral is generated; the edit must land exactly once or nothing is written.
 */
const path = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const AI = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const FROM = "٤٨. **عربية راقية وأرقام عربية على كل شاشاته** — *مبني — بلا دليل* —";
const TO = AI(
  "48. **عربية راقية وأرقام عربية على كل شاشاته** — *مبني — بلا دليل* — شاشات العميل اتقاست حيًّا على المنشور محطة محطة: 71 سلسلة عربية كانت تحمل كلمة لاتينية (الطلب 22 · البداية 26 · الأثاث 21 · الرئيسية 2) وبقى كلها صفر بعد ما كل جملة اتصلحت في مصدرها، مع حارس بيمشي على 202 ملف من سطح العميل. كمان محادثات المدير: من 159 كلمة لاتينية لـ 12 (92%) والاسم المتقاعد صفر. الفاضل في نفس البند: الأرقام اللاتينية في أسعار الكتالوج على شاشات العميل (قرار مالك)، وقوالب التقارير اللي لسه بتطالع عناوينها بالإنجليزي.",
);

let text = fs.readFileSync(path, "utf8");
const count = text.split(FROM).length - 1;
if (count !== 1) throw new Error(`المفتاح طابق ${count} مرة بدل مرة — ما اتكتبش`);
const next = text.replace(FROM, TO);
if (!next.includes("بقى كلها صفر")) throw new Error("السطر الجديد ما دخلش");
fs.writeFileSync(path, next, "utf8");
const reread = fs.readFileSync(path, "utf8");
console.log("مكتوب ومحفوظ:", reread.includes("بقى كلها صفر") ? "نعم" : "لا", "· طول الملف", reread.length, "محرف");
