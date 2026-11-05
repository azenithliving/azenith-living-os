import fs from "node:fs";

/**
 * Master list item 15: the brief form became the area's second door.
 *   node scratch/update-master-list-brief-area.mjs
 * The line is found by its own heading and replaced whole, so no numeral has to be matched by hand.
 */
const path = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const AI = (s) => String(s).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const MARK = "منبع المحادثة لسه نادر";
const NEW = AI(
  `   - **المنبع اتعبّى من عميل حقيقي (2026-10-08):** شارات المنطقة الـ11 اتحطّت في كراسة الطلب نفسها — في خطوة بيانات الاتصال، جنب الأسئلة اللي بتسأل ذوقه — والباب بيكتب المنطقة في نفس سطر الزائر اللي عليه طرازه وغرفته، مرة واحدة وباسم الخارطة، وبيقرا السطر تاني قبل ما يقول «سجلت». مقاس على المنشور: كراسة كاملة مشيت بعرض 390 كتبت «الشيخ زايد + مودرن + غرف المعيشة» في سطر واحد؛ وفي السجل كله سطور عليها منطقة = 3 منها بطراز = 2 (قبلها 1 و 0). وورقة الشيخ زايد اللي كانت امبارح بتقول «محسوب من ألوان ورقة عميل واحد» وبس، قالت النهاردة «محسوب من ألوان ورقة عميل واحد وطراز زائر واحد… وطرازهم مودرن» وأول تمن صورها modern فعلاً.
   - **فاضل في نفس البند:** نموذج النخبة (اللي بييجي من صفحة النخبة) لسه ما بيسألش عن المنطقة، و15 سطر من قيم الطراز المسجلة هي «elite-brief» — اسم صفحة اتخزن مكان الطراز، فلازم يتنظف من مصدره مش من السجل.`,
);

const text = fs.readFileSync(path, "utf8");
const lines = text.split(/\r?\n/);
const hits = lines.map((l, i) => (l.includes(MARK) ? i : -1)).filter((i) => i >= 0);
if (hits.length !== 1) throw new Error(`علامة السطر موجودة في ${hits.length} سطر بدل واحد — ما اتكتبش`);
lines[hits[0]] = NEW;
fs.writeFileSync(path, lines.join("\n"), "utf8");
console.log("محفوظ:", fs.readFileSync(path, "utf8").includes("المنبع اتعبّى من عميل حقيقي") ? "نعم" : "لأ");
