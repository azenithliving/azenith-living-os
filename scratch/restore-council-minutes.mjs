import fs from "node:fs";
import path from "node:path";

/**
 * The owner's council folder disappeared from the Desktop between 01:00 and 03:15 today — my own
 * appends succeeded an hour earlier and the path is now gone, and it is not in OneDrive, Documents,
 * Downloads or D:\alaa2. Nothing is being deleted or overwritten here: every minute I wrote tonight
 * exists verbatim in my own scratch scripts, so this rebuilds them into a NEW dated file beside the
 * old location. The original stays recoverable from OneDrive's own version history or online bin.
 *
 * Timestamps inside are the restore time, not the original minute — said out loud rather than faked.
 */
const OUT_DIR = "C:/Users/noura/OneDrive/Desktop";
const OUT = path.join(OUT_DIR, "محضر-الاجتماع-مسترجع-2026-10-07.md");
const ORDER = [
  "append-council-unread.mjs",
  "append-council-voice.mjs",
  "append-council-labels.mjs",
  "append-council-world.mjs",
  "append-council-refute.mjs",
  "append-council-negative.mjs",
  "append-council-correct.mjs",
];

if (fs.existsSync(OUT)) throw new Error("الملف المسترجع موجود بالفعل — مش هكتب فوقه");

const realAppend = fs.appendFileSync;
const collected = [];
fs.appendFileSync = (target, body) => {
  collected.push(String(body));
};

const header = [
  "# محضر الاجتماع — نسخة مسترجعة",
  "",
  `**ليه الملف ده:** مجلد «أجتماع» اختفى من سطح المكتب بين ٠١:٠٠ و٠٣:١٥ من يوم ٢٠٢٦-١٠-٠٧، بعد ما آخر إضافة نجحت. البحث في ون‌درايف والمستندات والتنزيلات و D:\\alaa2 ما لقاش حاجة بالاسم ده. النصوص كلها كانت محفوظة عند الوكيل في سكربتاته، فاتجمّعت هنا في ملف جديد بتاريخ النهاردة — والأصلى لسه ممكن يرجع من سجل نسخ ون‌درايف أو سلة المحذوفات على الموقع.`,
  `**تنبيه صدق:** الطوابع الزمنية جوه السطور دي هي وقت الاسترجاع (٠٣:١٥) مش وقت الكتابة الأصلي.`,
  "",
  "---",
].join("\n");

let ok = 0;
for (const name of ORDER) {
  const file = path.join("scratch", name);
  if (!fs.existsSync(file)) {
    console.log(`فقدان: ${name}`);
    continue;
  }
  try {
    await import(`../scratch/${name}`);
    ok += 1;
  } catch (err) {
    console.log(`ما اتقريتش: ${name} — ${String(err?.message ?? err).slice(0, 90)}`);
  }
}
fs.appendFileSync = realAppend;
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, header + collected.join("\n"), "utf8");
console.log(`minutes rebuilt: ${ok} of ${ORDER.length}`);
console.log(`file: ${OUT} · bytes: ${fs.statSync(OUT).size}`);
