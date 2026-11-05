import { readFileSync } from "node:fs";

/**
 * Which customer-facing sources put a Latin word inside an Arabic string.
 *   node scratch/census-source-mix.mjs
 *
 * A field whose name ends in `En` is an intended English branch and is skipped, as are machine
 * fields (slugs, values, hrefs, file paths). The DOM census cannot see a step the customer has
 * not opened yet, so this reads the sources themselves.
 */
const FILES = [
  "app/page.tsx",
  "app/furniture/page.tsx",
  "app/start/page.tsx",
  "app/rooms/page.tsx",
  "components/request-page-client.tsx",
  "components/AzenithLegacy.tsx",
  "components/FurnitureCard.tsx",
  "lib/site-content.ts",
  "lib/constants/furniture-data.ts",
  "lib/constants/rooms.ts",
  "lib/room-design-tips.ts",
  "app/rooms/[slug]/page.tsx",
];

const MACHINE_FIELD = /^\s*(?:readonly\s+)?(slug|value|href|src|video|id|key|image|imageUrl|icon|type|class|className|kicker)\s*[:=]/;
const ARABIC = /[\u0600-\u06FF]/;
const LATIN_WORD = /[A-Za-z]{3,}/;

let total = 0;
for (const file of FILES) {
  let src;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    console.log(`${file} — مقروء؟ لا: الملف مش موجود`);
    continue;
  }
  const hits = [];
  const partials = [];
  src.split(/\r?\n/).forEach((line, i) => {
    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
    if (MACHINE_FIELD.test(line)) return;
    if (/^\s*(?:export\s+)?(?:const|type|interface|import|function)\b/.test(line) && !ARABIC.test(line)) return;
    for (const m of line.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)) {
      // `${expr}` and {jsx} are code, not words the customer reads — strip them before judging.
      // Innermost-first, because a template can hold another template inside it.
      let s = m[1] ?? m[2] ?? m[3] ?? "";
      while (s.includes("${")) {
        const stripped = s.replace(/\$\{[^{}]*\}/g, " ");
        if (stripped === s) break;
        s = stripped;
      }
      s = s.replace(/\{[^{}]*\}/g, " ");
      // A template that opens another template is beyond a line reader: say so instead of guessing.
      const partial = s.includes("${");
      s = s.replace(/\$\{[\s\S]*$/g, " ");
      if (!s.trim() || !ARABIC.test(s) || !LATIN_WORD.test(s)) {
        if (partial) partials.push(`  ${i + 1}: القارئ ما كملش تحليل السلسلة (مداخلة أعشاش)`);
        continue;
      }
      const field = line.match(/([A-Za-z]+)\s*[:=]/)?.[1];
      if (field && /En$/.test(field)) continue;
      hits.push(`  ${i + 1}: ${s.slice(0, 90)}`);
      break;
    }
  });
  total += hits.length;
  console.log(`\n=== ${file} — ${hits.length} سلسلة خليط · ${partials.length} لم يكملها القارئ`);
  for (const h of hits) console.log(h);
  for (const p of partials) console.log(p);
}
console.log(`\nالإجمالي: ${total} سلسلة عربية تحمل كلمة لاتينية في مصدر موجه للعميل`);
