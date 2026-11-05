import fs from "node:fs";

/**
 * Master-list item 47, third exception found: a customer was told an opening hour the store never
 * ordered. Numerals are generated; the anchor must match exactly once or nothing is written.
 */
const path = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const AI = (s) => String(s).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const ANCHOR = "لأن سجل الصفوف الحالي فاضي.";
const ADD = AI(
  ". والنهار ده لقى استثناء تالت بيتقال لعميل: شاشة التأهيل كانت بتقول ميعاد فتح غلط (١٠ لـ ٦ وعطلة السبت والأحد) لأن الرقم كان معاد كتابته في الكود بدل ما يسأل سجل الدار — والسجل نفسه فيه سطر قديم بيقول 10 لـ 6 وسطر جديد بيقول 9 لـ 8. بقى فيه قارئ واحد للسطر، وآلة واحدة تحوّل الجملة لجدول وترفض بدل ما تخمن، والباب العام يوصّلها للصفحات. مقاس حيًّا على المنشور: الباب ردّ بجملة الميعاد حرفياً، والصفحة نادته ورجع 200، وصفر خطأ كونسول.",
);

const text = fs.readFileSync(path, "utf8");
const count = text.split(ANCHOR).length - 1;
if (count !== 1) throw new Error(`المفتاح طابق ${count} مرة بدل مرة — ما اتكتبش`);
fs.writeFileSync(path, text.replace(ANCHOR, ANCHOR + ADD), "utf8");
const reread = fs.readFileSync(path, "utf8");
console.log("محفوظ:", reread.includes("استثناء تالت") ? "نعم" : "لا", "· طول الملف", reread.length, "محرف");
