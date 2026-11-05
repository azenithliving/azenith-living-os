import { readFileSync, writeFileSync } from "node:fs";

const p = "docs/خطة-البناء/٠٠-للمالك.md";
let s = readFileSync(p, "utf8");

const subs = [
  [/البند \*\*٢٨ من ٤\*\*/, "البند **٢٨ من ٥٤**"],
  [/، و٥٠ ذرة ما اتنقلتش/, "، و٤٩٦ ذرة ما اتنقلتش"],
];

for (const [re, to] of subs) {
  const hits = s.match(new RegExp(re.source, "g")) ?? [];
  if (hits.length !== 1) throw new Error(`pattern ${re.source} matched ${hits.length} times`);
  s = s.replace(re, to);
}
writeFileSync(p, s, "utf8");
console.log(s.split(/\r?\n/).find((l) => l.includes("ومكانك النهاردة")) ?? "");
console.log(s.split(/\r?\n/).find((l) => l.startsWith("> **المرحلة ١")) ?? "");
