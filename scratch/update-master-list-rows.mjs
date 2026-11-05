import { readFileSync, writeFileSync } from "node:fs";

/**
 * Item 48 moves again: the row pass.
 *
 * The last number on this bullet was 114 Latin places. This pass closed the ones the store composes
 * itself — the luxury line, the empty-measurement cells, the roll's badges and its English room
 * spellings — and the count is re-taken with the same instrument on the same ten screens.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const file = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const text = readFileSync(file, "utf8");

const ANCHOR = "فالجملة تتصلح في مصدرها.";
const MARK = ar("وبعدها: 114 بقوا");

if (!text.includes(ANCHOR)) {
  console.log("anchor not found — nothing written");
  process.exit(1);
}
if (text.includes(MARK)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const proof = readFileSync("scratch/latin-after-rows.out", "utf8");
const m = proof.match(/شاشات: (\d+) · كلمات لاتينية مختلفة: (\d+) · مجموع المواضع: (\d+)/);
if (!m) {
  console.log("REFUSING TO WRITE: the census line is missing from the proof file.");
  process.exit(1);
}
const [, screens, words, places] = m.map(Number);

const addition = ar(` **وبعدها: 114 بقوا ${places}** (قياس بنفس العدّاد على ${screens} شاشات، و${words} كلمة مختلفة). اللي قفل الرقم ده كان سطور مش كلمات: سطر الفخامة اللي الكود كان بيكتبه «Luxury Score مقاسة … p95 = 229ms» بقى عربي من مصدره، والصف اللي مفيش فيه قياس («N/A» و«[]») بقى بيقول «مش مقاس»، وجدول الموديل بقى يتارسم بدل ما يطبع علامات الخلايا، وصف دفتر العميل بقى «الصالة · ٠١٠٢٣٤٦٧٨» بدل «Living Room (L-shaped sofa / ركنة) | 01002345678» وشعاراته «بيكتب» و«تسليم لموظف» بدل PRE-COG و HUMAN. والفاضل: كلام الموديل المخزّن قديمًا · مسارات الموقع وعناوين المزودين وإيميلات العملاء (مسموح بقراره) · 6 سطور حساب («٢× = 540000 ج.م») دول معادلات مش حروف، والحل إنها تتارسم من اليسار لليمين.`);

writeFileSync(file, text.replace(ANCHOR, ANCHOR + addition), "utf8");
const after = readFileSync(file, "utf8");
console.log(`screens=${screens} words=${words} places=${places} written: ${after.includes(MARK)}`);
