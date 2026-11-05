import { readFileSync, writeFileSync } from "node:fs";

/**
 * Three wording defects in the minute that was just appended.
 *
 * The digit converter that turns Latin numerals into his numerals also ate a digit out of a date and
 * rewrote a file name; and one bullet says the same thing twice. This patches the lines by their
 * Arabic text and verifies each anchor exactly once before writing.
 */
const file = "docs/ledger/council-minutes.md";
const text = readFileSync(file, "utf8");

const EDITS = [
  { from: "التاريخ («٢٠٢-٠٦-٢٨»)", to: "التاريخ («٢٠٢٦-٠٦-٢٨»)" },
  { from: "ملف باسم math-screen-٣٩٠.png", to: "ملف باسم math-screen-390.png" },
  {
    from: "· ١٥ مجموعة اتقاس ترتيبها بمكان الحروف: الترتيب مقاس بمكان الحروف على الشاشة: أول حرف شمال آخر حرف.",
    to: "· ١٥ مجموعة قيس ترتيبها بمكان حروفها على الشاشة: أول حرف شمال آخر حرف.",
  },
  { from: "وكلمة عربية بين رقمين ببتقطع المجموعة", to: "وكلمة عربية بين رقمين بتقطع المجموعة" },
];

for (const edit of EDITS) {
  const hits = text.split(edit.from).length - 1;
  if (hits !== 1) {
    console.log(`REFUSING: anchor found ${hits} times — ${edit.from.slice(0, 40)}`);
    process.exit(1);
  }
}

let out = text;
for (const edit of EDITS) out = out.replace(edit.from, edit.to);
writeFileSync(file, out, "utf8");

const after = readFileSync(file, "utf8");
console.log("fixed:", EDITS.every((e) => after.includes(e.to) && !after.includes(e.from)));
