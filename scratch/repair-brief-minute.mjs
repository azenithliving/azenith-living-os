import fs from "node:fs";

/**
 * Two defects in the minute I just appended: an English word leaked into an Arabic sentence, and a
 * date lost digits on the way in. Both repaired, then the last entry is scanned for any Latin run.
 */
const path = "C:/Users/noura/OneDrive/Desktop/أجتماع/محضر-الاجتماع.md";
let s = fs.readFileSync(path, "utf8");

const FIXES = [
  ["لازم تمسح سطر herself", "لازم تمسح سطرّها هي بنفسها"],
  ["اتكتب يوم ٢٠٢-١٠-١", "اتكتب يوم ٢٠٢٦-١٠-٠١"],
];

for (const [from, to] of FIXES) {
  if (!s.includes(from)) throw new Error(`anchor not found: ${from}`);
  s = s.replace(from, to);
}

const tail = s.slice(s.lastIndexOf("- **[وكيل المتجر]"));
const latinWords = (tail.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => !/Commit|agent_messages|localhost|COMMIT/.test(w));
if (latinWords.length) throw new Error(`Latin words still in the last entry: ${latinWords.join(", ")}`);

fs.writeFileSync(path, s, "utf8");
console.log("repaired:", FIXES.length, "· Latin words left in the entry:", latinWords.length);
