import { readFileSync, writeFileSync } from "node:fs";

/**
 * The room tips the customer reads on a room page: the lamp technology spelled in Latin and the
 * colour temperature written as a unit symbol, both replaced with the words an Egyptian reads.
 *   node scratch/fix-design-tips.mjs        — show every line that would change
 *   node scratch/fix-design-tips.mjs apply  — write, then re-read the file and count again
 *
 * Only the Arabic fields (`content`, `title`) are touched; the `…En` companions keep their English.
 */
const APPLY = process.argv[2] === "apply";
const FILE = "lib/room-design-tips.ts";

const rules = [
  [/\btitle: "إضاءة LED"/, 'title: "إضاءة مدمجة"'],
  [/(\d[\d-]*)K\b/, "$1 كلفن"],
  [/\s+LED\b/g, ""],
];

const lines = readFileSync(FILE, "utf8").split(/\r?\n/);
const changed = [];
const next = lines.map((line, i) => {
  if (!/^\s*(?:content|title): /.test(line)) return line;
  let out = line;
  for (const [from, to] of rules) out = out.replace(from, to);
  if (out !== line) changed.push(`${i + 1}:\n    قبل: ${line.trim().slice(0, 95)}\n    بعد: ${out.trim().slice(0, 95)}`);
  return out;
});

console.log(`${changed.length} سلسلة تتغيّر في ${FILE}`);
for (const c of changed) console.log(c);

if (APPLY) {
  writeFileSync(FILE, next.join("\n"), "utf8");
  const reread = readFileSync(FILE, "utf8").split(/\r?\n/);
  // Judge only what the customer reads: the value inside the quotes, never the field name.
  const left = reread
    .map((l) => l.match(/^\s*(?:content|title): "([^"]*)"/)?.[1])
    .filter((v) => v && /[\u0600-\u06FF]/.test(v) && /[A-Za-z]{3,}/.test(v));
  const kelvin = reread.filter((l) => /^\s*(?:content|title): /.test(l) && /\dK\b/.test(l)).length;
  console.log(`\nقراية راجعة: سلاسل الحقول العربية = ${reread.filter((l) => /^\s*(?:content|title): "/.test(l)).length} · منها ما زال يحمل كلمة لاتينية = ${left.length} · وما زال يحمل K كرمز = ${kelvin}`);
  for (const l of left) console.log("  بقية: " + l.slice(0, 90));
}
