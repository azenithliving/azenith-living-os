import fs from "node:fs";

/**
 * Master-list item 20 — the full customer journey — after tonight's sequenced run.
 * Numerals are generated; the anchor must match exactly once or nothing is written.
 */
const path = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const AI = (s) => String(s).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const FROM = "٢٠. **الرحلة الكاملة: دخول ← منطقة ← لوحة مزاج ← ورقة ← جواز ← تصويت ← تنبيه ← مكالمة** — *مش مبني* — دي حلقة الاختبار الكبرى، ومفيش تشغيل واحد متسلسل مُثبت";
const TO = AI(
  "20. **الرحلة الكاملة: دخول ← منطقة ← لوحة مزاج ← ورقة ← جواز ← تصويت ← تنبيه ← مكالمة** — *مُثبت بدليل* — مشيت متسلسلة على الرابط المنشور 2026-10-07 بآلة واحدة: 11 محطة ثبتت وصفر واقفة (دخول بأربع اختيارات · بوابة العميل في صفحة الطلب · ورقة من غير دخول · عنوان سرّي · مقاسات هو اللي كتبها والقفل نزل · تلات ألوان والرابع يقفل · تصويت اتنين على نفس الرابط · نبضة على الورقة · الملف الذهبي عند المالك لاقاه وزرار «اتصل بيه» · صفر خطأ كونسول). وفيها محطة مالهاش عنوان لسه: «المنطقة». وثلاث عيوب طلعت وهي بتمشي اتصلحت: مقابض شاشة المقاسات، و404 كل زبون بيفتح الشات بيولّده، والورقة ما كانتش مصدر من مصادر الدفتر فكان العميل «مفيش حد بهالحرف».",
);

const text = fs.readFileSync(path, "utf8");
const count = text.split(FROM).length - 1;
if (count !== 1) throw new Error(`المفتاح طابق ${count} مرة بدل مرة — ما اتكتبش`);
fs.writeFileSync(path, text.replace(FROM, TO), "utf8");
const reread = fs.readFileSync(path, "utf8");
console.log("محفوظ:", reread.includes("11 محطة ثبتت".replace(/11/, "١١")) || reread.includes("محطة ثبتت") ? "نعم" : "لا");
