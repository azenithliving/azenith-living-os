import { readFileSync, writeFileSync } from "node:fs";

/**
 * Master-list item 47 again: the second exception the owner's honesty brake needs —
 * an employee stating a business condition no desk measured — now has a guard, and the
 * guard was proved on the published site with its negative control.
 */
const PATH = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const ar = (t) => t.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));

const ADD = ar(
  " واللي بعده: بقى لكل شرط مكتبه. عشر حالات مقاسة من ٨٦٥ سطر عنده — المبيعات والزيارات وعدد الغرف بتتقيس بقراءة العالم، ودرجة الجودة بمقياس الفخامة، والمنافس بمكتب المنافسين، و«الوضع تمام» بمكاتب الفحص — وحالتين مقفولتين على عمد لأن مفيش قياس عندهم: المخزون الجاهز (المالك أمر إن كله بيتعمل حسب الطلب) والمواعيد (مسجّلة في دفتر الدار ومفيش مكتب في الشات بيقراه لسه). الشرط من غير قياس بتتشال جملته وبيتحط سطر عربي بيقول إيه اللي اتشال وليه — من غير مفتاح آلة. محروس بـ١٧ اختبار، ومقاس على المنشور بعرض ٣٩٠ في حالتين: سؤال «قولي حالة الدار» طلع بسطر الاتشال وسطر «مفيش مكتب اتشغّل» · وعكس الاختبار «ايزاي الشغل الفترة دي» طلع بكل رقماته سايبه (٧٠٠٠٠ ج.م · ٦٤ جلسة · ١٥ قسم) لأن القراءة الحيّة نفسها بقت مسجّلة كمكتب. وعيب اتكشف على المسرح: قسّام الجُمل كان بيقطع عند نقطة الاختصار في «ج.م» فبيبص الادّعاء من غير ما يشيله — اتصلّح والنقطة ما تنهيش جملة إلا لو وراها مسافة، واتعاد على نفس السطر المخزّن وطلع مشمول."
);

const before = readFileSync(PATH, "utf8");
const lines = before.split("\n");
const i = lines.findIndex((l) => l.startsWith("٤٧."));
if (i < 0) throw new Error("item 47 not found");
if (lines[i].includes("بقى لكل شرط مكتبه")) {
  console.log("already updated — nothing written");
} else {
  lines[i] = lines[i].trimEnd() + ADD;
  writeFileSync(PATH, lines.join("\n"), "utf8");
  console.log(`item 47 line ${i + 1}: ${before.length} → ${lines.join("\n").length} chars`);
}
console.log("tail:", readFileSync(PATH, "utf8").split("\n")[i].slice(-180));
