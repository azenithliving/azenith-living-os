import { readFileSync, writeFileSync } from "node:fs";

/**
 * A dated re-measurement of the yardstick itself, written the way the file already records updates.
 *
 * Two things were found by counting rather than reading: the file's own total line was stale against
 * the statuses written under its items, and accessibility — the thing the owner asked about when he
 * asked "when is it AAA" — had never been measured at all and was not a line in the list.
 *
 * The Arabic body carries no backticks: it is inside a template literal, and a code span would end it.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const MARKER = ar("تحديث 2026-10-11");

const file = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const text = readFileSync(file, "utf8");

if (text.includes(MARKER)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const addition = ar(`

---

**${"تحديث 2026-10-11"} (إعادة قياس + أول قياس إتاحة):**

- **العدد الإجمالي اتعاد عدّه من سطور البنود نفسها، مش من سطر الخلاصة:** من 53 بند — **24 مُثبت بدليل**، و**27 مبني من غير دليل**، و**2 مش مبني** (بند تطهير مفاتيح البيئة، وبند مسح اللوحة القديمة — والتاني متعمد بفرملك). سطر الخلاصة كان بيقول 20 و30 و3 من 2026-10-07، و11 بند غيّر حالته بعده من غير ما السطر يتعدّل.
- **الإتاحة اتقاست النهاردة لأول مرة، والنتيجة إنها ما كانتش في القايمة أصلًا** — فاتسجّلت بند جديد (54). القياس: أداة فحص الإتاحة محقونة وقت التشغيل من أدوات التطوير عندنا، ومفيش حاجة منها بتوصل للزائر؛ ست شاشات على عرض 390 على الرابط المنشور. اللي طلع: **4 لـ 5 قواعد مخترقة في كل شاشة**، و**نفس العيب الحرج في الست شاشات: زرار بلا اسم يقرأه قارئ الشاشة (9 مواضع)**، و**حقل في كراسة العميل بلا تسمية**، و**ترتيب العناوين مخترق في تلات شاشات**، و**محتوى بره مناطق العلامة في تلات شاشات**، و**مفيش عنوان رئيسي في كابينة القائد**. قاعدة التباين من الدرجة العليا **مخترقة في الشاشتين التابعتين لك**.
- **ليه القياس التاني اتعمل باليد:** المتجر بيرسم خلفيته بطبقة تدرّج مش بلون خلفية — مقيس: لون خلفية الجسم شفاف بالكامل، والسواد جاي من تدرّج خطي من 22،22،23 لـ 26،26،27 وفوقه لمسة ذهب بنسبة 18%. أدوات الفحص ما بتشوفش ورا التدرّج، فاتعملت طبقات مركّبة بنفس ترتيب المتصفح: **8 من 71 سطر نص على الواجهة بيقع تحت الحد المعتاد و9 تحت الحد العالي** · كراسة العميل 2 و3 · كابينة القائد 15 من 35 · شاشة غرفة المعيشة والشروط صفر. التحفّظ الواجب: القياس ده بيحسب النصوص المخفية بصريًا (رايط القفز ورموز الوجوه) والتباين ما ينطبقش عليها — فأرقام الأداة هي الأرضية والقياس اليدوي هو السقف.
- **الباقي من نفس الجذر:** الإصلاح متسجّل خطوة (تسمية كل زرار وحقل بالعربي، ترتيب العناوين، مناطق العلامة، رفع الألوان الواقعة)، وبعدها إعادة قياس بنفس الأداة ونشر رقم قبل وبعد.

## بند مضاف — سادساً — الهندسة والجودة

٥٤. **إتاحة بالمعايير العالمية على شاشات العميل وشاشته** — *مش مبني* — اتقاس النهاردة لأول مرة وطلع راسب: 9 أزرار بلا اسم · حقل بلا تسمية · تباين الدرجة العليا واقع في شاشتين · ترتيب العناوين ومناطق العلامة ناقص. محروس بقياس قابل للإعادة، مش بانطباع.
`);

writeFileSync(file, text.trimEnd() + addition, "utf8");

const after = readFileSync(file, "utf8");
const line = after.split(/\r?\n/).find((l) => l.includes(MARKER));
console.log("written. update line:");
console.log(line ? line.slice(0, 160) : "MISSING");
console.log("file lines:", after.split(/\r?\n/).length, "was:", text.split(/\r?\n/).length);
