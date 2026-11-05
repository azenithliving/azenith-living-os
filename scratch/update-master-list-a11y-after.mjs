import { readFileSync, writeFileSync } from "node:fs";

/**
 * The audit came back clean, so the yardstick's own line has to say what is now proven and what is
 * still only six screens out of the whole site — a status that stops short of the claim, rather than
 * one that overshoots it.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));

const file = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const text = readFileSync(file, "utf8");

const before = text.split("\n").find((l) => l.includes(ar("إتاحة بالمعايير العالمية")));
if (!before) {
  console.error("the accessibility item was not found — nothing written");
  process.exit(1);
}

const after = ar(`54. **إتاحة بالمعايير العالمية على شاشات العميل وشاشته** — *مُثبت بدليل على 6 شاشات، والباقي مقاسش* — اتقاست النهاردة لأول مرة وطلعت راسبة (22 قاعدة في 30 موضع)، واتصلحت كلها في نفس اليوم: **صفر قاعدة وصفر موضع** في الواجهة · صفحة غرفة معيشة · كراسة العميل · الشروط · كابينة القائد · حالة النظام، بقياس حيّ على الرابط المنشور بعرض 390 بأداة الفحص نفسها. اللي لسه ما اتقاسش: باقي شاشات العميل والشاشات الإدارية — فالرقم ده ست شاشات، مش الموقع كله.`);

const updated = text.replace(before, after);

const tail = ar(`
- **وبعد الإصلاح في نفس اليوم (قياس تاني بنفس الأداة):** قواعد الفحص نزلت من **22 لـ 0** ومواضع العيوب من **30 لـ 0** على الست شاشات — الأزرار بقت مسماة بالعربي، والحقل بلا تسمية اتسمى، والتباين اللي كان 2.77 و3.75 بقى فوق الحد، وصفحة الاستوديو بقى ليها عنوان رئيسي، والعناوين مابقاش فيها قفز. الصور اتبصّيت عليها: الفوتر وشيبات الطرازات لسه نفس اللمسة الغامقة الدافية، بس بقوا مقروئين. الحرّاس: 9 اختبارات بتمنع إن الأسماء تتشال تاني.
`);

writeFileSync(file, updated.trimEnd() + "\n" + tail, "utf8");

const check = readFileSync(file, "utf8");
console.log("item line now:");
console.log(check.split(/\r?\n/).find((l) => l.includes(ar("إتاحة بالمعايير العالمية")))?.slice(0, 200));
console.log("\ntail present:", check.includes(ar("وبعد الإصلاح في نفس اليوم")));
console.log("old status gone:", !check.includes("*مش مبني* — اتقاس النهاردة"));
