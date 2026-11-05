import { readFileSync, writeFileSync } from "node:fs";

/** One more bullet on today's update: the owner's screens counted for Latin words, by rendering. */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const file = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const text = readFileSync(file, "utf8");

const ANCHOR = ar("- **البوابات النهارده:** 2005 اختبار أخضر");
const MARK = ar("البند 48 (قياس اللاتيني بالعين");

if (!text.includes(ANCHOR)) {
  console.log("anchor not found — nothing written");
  process.exit(1);
}
if (text.includes(MARK + " (قياس اللاتيني)")) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const bullet = ar(`
- **البند 48 (قياس اللاتيني بالعين، مش بالبحث):** عدّاد جديد فتح 10 من شاشات المالك على الرابط المنشور وبيعدّ كل كلمة لاتينية بتطبعها الصفحة فعلاً: **من 179 موضع في 114 كلمة لـ 137 في 90**. الجذر كان إن وحدة الأسماء كانت تعرف أسماء السرب الثمانية بس، فأي موظف برّاها بيُطبع مفتاحه: كارت مكتب المبيعات كان عنوانه «vanguard»، ودار الموظفين القديمة كانت تصرخ «VANGUARD · ANALYST · OPS-LEAD»، وعمود كامل في جدول المهام كان مفاتيح. **دلوقتي مفيش ولا مفتاح موظف بيطبع اسم على شاشته** (الدار نزلت من 27 سطر لاتيني لـ 11). والفاضل 137 موضع كله على أربع أنواع: 84 كلمة إنجليزي جوه كلام مكتوب باسم الدار (ده الشغل الجاي) · 27 مسار موقع · 16 عنوان مزود · 10 إيميل عميل — والتلاتة الأخيرين مسموحين بقراره.
`);

writeFileSync(file, text.replace(ANCHOR, bullet.trimStart() + "\n" + ANCHOR), "utf8");
const after = readFileSync(file, "utf8");
console.log("written:", after.includes(MARK + " (قياس اللاتيني)"), "| file lines:", after.split(/\r?\n/).length);
