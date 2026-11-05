import fs from "node:fs";

/**
 * Corrects master-list item 15 against the LAST measured run, not the earlier one.
 *   node scratch/fix-master-list-region.mjs
 * Anchors must match exactly once each, or nothing is written.
 */
const path = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";

const edits = [
  [
    "وورقة الشيخ زايد بتقول «… محسوب من ورقة عميل واحد في منطقتك، وألوانها كاراميل». **والترتيب اختلف فعلاً:** الصورة اللي جات أولًا في التجمع هي اللي جات تالتة في الشيخ زايد، والصورة اللي جات أولًا في الشيخ زايد جات تاسعة في التجمع.",
    "وورقة الشيخ زايد بتقول «… محسوب من ورقة عميل واحد في منطقتك، وألوانها أوف وايت». **والترتيب اختلف فعلاً:** الصورة اللي جات أولًا في التجمع جات التاسعة في الشيخ زايد، واللي جات أولًا في الشيخ زايد جات التانية في التجمع.",
  ],
  [
    "السجل نفسه رجّع المناطق الأربع مكتوبة: التجمع · التجمع · الشيخ زايد · الشيخ زايد · الإسكندرية.",
    "السجل نفسه رجّع المناطق الخمس مكتوبة: الإسكندرية · التجمع · الشيخ زايد · التجمع · الشيخ زايد (بالترتيب اللي بيطلع من رقم الورقة).",
  ],
];

let text = fs.readFileSync(path, "utf8");
for (const [from, to] of edits) {
  const n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`المفتاح طابق ${n} مرة بدل مرة — ما اتكتبش: ${from.slice(0, 40)}`);
  text = text.replace(from, to);
}
fs.writeFileSync(path, text, "utf8");
const check = fs.readFileSync(path, "utf8");
console.log("محفوظ:", check.includes("المناطق الخمس") && check.includes("جات التاسعة في الشيخ زايد") ? "نعم" : "لأ");
