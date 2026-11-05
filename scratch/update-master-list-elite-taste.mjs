import fs from "node:fs";

/**
 * Master list item 15: the elite brief became a second door for taste and area.
 *   node scratch/update-master-list-elite-taste.mjs
 * The line is found by its own heading and replaced whole, so no numeral is matched by hand.
 */
const path = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const AI = (s) => String(s).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const MARK = "نموذج النخبة (اللي بييجي من صفحة النخبة) لسه ما بيسألش";
const NEW = AI(
  `   - **نموذج النخبة بقى بيسأل هو كمان (2026-10-09):** محطة رابعة في كراسة النخبة فيها 4 شارات للطرازات اللي البنك بيحفظ بيها و11 شارة للمنطقة، والباب بيسلّم الاتنين لسطر الزائر — مقاس على المنشور بعرض 390: سطر «يوسف القياس» طلع بطراز «مودرن» ومنطقة «التجمع»، وسطور جديدة عليها اسم صفحة = صفر، وسطور عليها منطقة وطراز مع بعض = 3. وباب النخبة نفسه كان بيقطع المنطقة (بيعيد بناء الطلب حقل حقل وما بينقلش الحقل) — اتصلح وله اختبارات تسلم الباب للسطر.
   - **فاضل في نفس البند:** ١٤ سطر قديم لسه قيمته «elite-brief» في خانة الطراز — ما اتحذفتش لأن الحذف في القاعدة كلمة المالك، والحرّاس بتمنع الجديد. وتلات تبعات اتسجلت مهام: الباب بيسجّل الشاشتين تحت اسم صفحة واحد · شاشة كراسة النخبة لسه بتكلّم العميل بالإنجليزي · رسومات الطراز في اللوحة بتعدّ العمود كما هو (اسم صفحة بيحسب طراز، و«مودرن» و«modern» طرازين).`,
);

const text = fs.readFileSync(path, "utf8");
const lines = text.split(/\r?\n/);
const hits = lines.map((l, i) => (l.includes(MARK) ? i : -1)).filter((i) => i >= 0);
if (hits.length !== 1) throw new Error(`علامة السطر موجودة في ${hits.length} سطر بدل واحد — ما اتكتبش`);
lines[hits[0]] = NEW;
fs.writeFileSync(path, lines.join("\n"), "utf8");
console.log("محفوظ:", fs.readFileSync(path, "utf8").includes("نموذج النخبة بقى بيسأل هو كمان") ? "نعم" : "لأ");
