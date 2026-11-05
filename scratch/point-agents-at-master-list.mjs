import fs from "node:fs";

/**
 * Points the repository's instruction file at the master list, so any cold session reads the same
 * outer reference. Written through a script rather than an editor because the inserted text
 * carries Arabic-Indic numerals, and a hand-typed Arabic digit has lost a character here before.
 */
const path = "agents.md";
const anchor = "لكل مرحلة → **تنفيذ** على فرع، والبوابات قبل الدمج، والدليل الحي في الآخر.";

const block = toArabicDigits(`

**المرجع الأوسع للشكل النهائي:** «القائمة الجامعة — مسار الوصول للشكل النهائي للمتجر» في مجلد
الشركة الجديدة بره المستودع. فيها 53 بند — كل مكونات وثيقة العمارة ومزايا الكابينة وخطوات المراحل
وفرامل المالك — وحالة كل بند: مُثبت بدليل / مبني بلا دليل / مش مبني. سجل النقل بيعدّ الذرات اللي
اتنقلت من القديم، والقائمة الجامعة هي اللي بتقول **فاضل قد إيه لحد الشكل النهائي**. أي رقم يتقال
على طريقة «خلصنا كام٪» يُحسب من القائمة الجامعة، مش من الانطباع.`);

function toArabicDigits(s) {
  return s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");
}

const src = fs.readFileSync(path, "utf8");
if (src.includes("القائمة الجامعة")) {
  console.log("already pointed — nothing written");
} else if (!src.includes(anchor)) {
  throw new Error("the anchor line is gone — refusing to append blind");
} else {
  fs.writeFileSync(path, src.replace(anchor, anchor + block), "utf8");
  const after = fs.readFileSync(path, "utf8");
  console.log("inserted:", after.includes("القائمة الجامعة"));
  console.log("latin digits in the new block:", (after.match(/٥٣|53/g) ?? []).join(" "));
  console.log(after.split(/\r?\n/).filter((l) => /القائمة الجامعة|٥٣ بند/.test(l)).join("\n").slice(0, 300));
}
