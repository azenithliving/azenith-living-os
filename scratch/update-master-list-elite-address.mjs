import fs from "node:fs";

/**
 * Master list item 15: the elite screens learned to sign their own address.
 *   node scratch/update-master-list-elite-address.mjs
 * The line is found by its own heading and replaced whole, so no numeral is matched by hand.
 */
const path = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const AI = (s) => String(s).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const MARK = "وتلات تبعات اتسجلت مهام";
const NEW = AI(
  `   - **فاضل في نفس البند:** ١٤ سطر قديم لسه قيمته «elite-brief» في خانة الطراز — ما اتحذفتش لأن الحذف في القاعدة كلمة المالك، والحرّاس بتمنع الجديد. وتلات تبعات اتسجلت مهام، اتنفذ منها واحدة (2026-10-09): باب النخبة كان بيسجّل الشاشتين تحت اسم صفحة واحد — بقى كل مسار يقول عنوانه، ومقيس على المنشور: سطر «مسار النخبة» كتب /elite-intelligence وطراز «كلاسيك» ومنطقة «مدينتي»، والورقة بتقرأ العنوانين بالعربي. فاضل منها: شاشة كراسة النخبة لسه بتكلّم العميل بالإنجليزي · ورسومات الطراز في اللوحة بتعدّ العمود كما هو (اسم صفحة بيحسب طراز، و«مودرن» و«modern» طرازين).`,
);

const text = fs.readFileSync(path, "utf8");
const lines = text.split(/\r?\n/);
const hits = lines.map((l, i) => (l.includes(MARK) ? i : -1)).filter((i) => i >= 0);
if (hits.length !== 1) throw new Error(`علامة السطر موجودة في ${hits.length} سطر بدل واحد — ما اتكتبش`);
lines[hits[0]] = NEW;
fs.writeFileSync(path, lines.join("\n"), "utf8");
console.log("محفوظ:", fs.readFileSync(path, "utf8").includes("اتنفذ منها واحدة") ? "نعم" : "لأ");
