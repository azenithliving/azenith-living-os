import { readFileSync, writeFileSync } from "node:fs";

/**
 * Item 48 moves again: the place-label pass.
 *
 * 114 became 82 with the row pass, and 82 became this number with the addresses in his chat said as
 * the places they lead to. The original bullets stay — the file records what was measured when.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const file = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const text = readFileSync(file, "utf8");

const ANCHOR = "والحل إنها تتارسم من اليسار لليمين.";
const MARK = ar("وبعدها: 82 بقوا");

if (!text.includes(ANCHOR)) {
  console.log("REFUSING: anchor not found");
  process.exit(1);
}
if (text.includes(MARK)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const census = readFileSync("scratch/latin-after-places.out", "utf8");
const m = census.match(/شاشات: (\d+) · كلمات لاتينية مختلفة: (\d+) · مجموع المواضع: (\d+)/);
const proof = readFileSync("scratch/proof-place.out", "utf8");
const p = proof.match(/عناوين مسماة: (\d+) · مسار خام لسه: (\d+)/);
if (!m || !p) {
  console.log("REFUSING TO WRITE: the census or the proof line is missing.");
  process.exit(1);
}
const [, screens, words, places] = m.map(Number);
const [labeled, raw] = p.slice(1).map(Number);

const addition = ar(` **وبعدها: 82 بقوا ${places}** (نفس العدّاد على ${screens} شاشات، ${words} كلمة مختلفة). اللي نزل بالرقم ده العنوان: الشات كان بيحوّل مسار موقعه لرابط ويكتب المسار نفسه قدامه — «/products/sofa-malaki-…» و«/rooms» و«/furniture» — ${labeled} عنوان بقوا النهاردة مسمّين بالمكان اللي بيوصلوا له (${raw} مسار خام باقٍ)، والعنوان نفسه ورا الضغطة. الأسماء كلها من قواميس الدار الموجودة: قسم من مكتب المسودات، وغرفة من قاموس الغرف الواحد، وباب المعاينة بقى «معاينة المسودة»، والمجهول بقى «مكان من غير اسم» بدل ما يطبع نفسه. وإجراء النشر بقى «تم طلب النشر» بدل «تم طلب نشر Vercel — راقب لوحة Vercel». والفاضل: كلام الموديل المخزّن قديمًا (Genesis و Health و SEO) · 31 كلمة في مكتب المفاتيح هي عناوين المزودين وبادئات المفاتيح (أسماء لا تُترجم) · إيميلات العملاء · مسارات الموقع كعناوين كاملة (مسموح بقراره).`);

writeFileSync(file, text.replace(ANCHOR, ANCHOR + addition), "utf8");
const after = readFileSync(file, "utf8");
console.log(`places=${places} words=${words} labeled=${labeled} raw=${raw} written: ${after.includes(MARK)}`);
