import fs from "node:fs";

/**
 * Repairs a split sentence in the instruction file.
 *
 * The standing-authority block was inserted on the anchor "**مفيش خطوة اتناشرت.**" — which is the
 * FIRST words of a longer paragraph, so the insert landed mid-sentence and left the tail
 * ("كل مرحلة بتقف عند حدّها وتستنى كلمة") sitting after the new rule, contradicting it. The fix
 * moves the block below the whole paragraph and adds the amending clause the owner's own hygiene
 * rule asks for: an amendment names what it changes, it does not delete the old line.
 */
const path = "AGENTS.md";
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

const blockStart = lines.findIndex((l) => l.includes("تفويض المالك الدائم"));
const blockEnd = lines.findIndex((l) => l.includes("من غير نسخة في"));
const anchorLine = lines.findIndex((l) => l.includes("مفيش خطوة اتناشرت"));
// The paragraph's last word, searched only after the block: "مش من" appears earlier in the file
// too, and a marker found in the wrong place would have moved text into the wrong section.
const paragraphEnd = lines.findIndex((l, i) => i > blockEnd && l.includes("الانطباع"));

if ([blockStart, blockEnd, anchorLine, paragraphEnd].some((i) => i < 0))
  throw new Error(`markers not found: ${JSON.stringify({ blockStart, blockEnd, anchorLine, paragraphEnd })}`);
if (!(blockStart > anchorLine && blockEnd < paragraphEnd))
  throw new Error(`the block is not inside the paragraph — nothing to repair (${blockStart}, ${blockEnd}, ${paragraphEnd})`);

const block = lines.splice(blockStart, blockEnd - blockStart + 1);
// The anchor line now sits alone again; rejoin it to its own tail by removing the blank seam the
// insert left behind.
while (blockStart - 1 < lines.length && lines[blockStart - 1].trim() === "") lines.splice(blockStart - 1, 1);

block.push(
  "",
  "**تعديل على السطر اللي فوق:** «كل مرحلة بتقف عند حدّها وتستنى كلمة» كان معناه كلمة البدء وكلمة",
  "النشر؛ التفويض ده بيراجعه: الكلمة اتقالت مرة واحدة وبقت دائمة، واللي يفضل واقف waiting هو",
  "المسح والحذف وقرارين ملكيتهم بس — وباقي البوابات والحرّاس والسجل زي ما هو، ما اتنقصش منها حرف."
);

lines.splice(paragraphEnd + 1, 0, "", ...block);
fs.writeFileSync(path, lines.join("\n"));

const after = fs.readFileSync(path, "utf8");
const idx = after.split(/\r?\n/).findIndex((l) => l.includes("مفيش خطوة اتناشرت"));
console.log(after.split(/\r?\n/).slice(idx, idx + 3).join("\n"));
console.log("---- block placed after the paragraph:", after.indexOf("تفويض المالك الدائم") > idx);
