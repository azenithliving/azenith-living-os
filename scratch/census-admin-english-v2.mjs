import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Census: Latin words inside the Arabic copy the owner's own screens print.
 * Whole-file scan — a JSX text node usually opens on the line above it, so a per-line read
 * misses the exact heading this census exists to find.
 */
function walk(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx$/.test(full) ? [full] : [];
  });
}

const ARABIC = /[\u0600-\u06FF]/;
const LATIN_WORD = /[A-Za-z]{3,}/g;
const files = [...walk("app/admin"), ...walk("components/admin")];
const rows = [];

for (const file of files) {
  const src = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const at = (index) => src.slice(0, index).split("\n").length;
  const push = (index, text, kind) => {
    const trimmed = text.trim();
    if (!ARABIC.test(trimmed)) return;
    // A `>` between two expressions is a comparison, not a tag: real copy is one line and carries no code.
    if (/\n|;|\/\/|=>|\bconst\b/.test(trimmed)) return;
    const words = (trimmed.match(LATIN_WORD) ?? []).filter((w) => !/^(https?|www)$/i.test(w));
    if (words.length) {
      rows.push({ file: file.replace(/\\/g, "/"), line: at(index), kind, text: trimmed.slice(0, 90), words });
    }
  };

  for (const m of src.matchAll(/>([^<>{}]+)</g)) push(m.index, m[1], "text");
  for (const m of src.matchAll(/(?:placeholder|title|aria-label)="([^"]*)"/g)) push(m.index, m[1], "attr");
}

const digitRows = [];
for (const file of files) {
  const src = readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const m of src.matchAll(/>([^<>{}]+)</g)) {
    const trimmed = m[1].trim();
    if (!ARABIC.test(trimmed) || /\n|;|\/\/|=>|\bconst\b/.test(trimmed)) continue;
    const digits = trimmed.match(/\d+/g) ?? [];
    if (digits.length) {
      digitRows.push(`${file.replace(/\\/g, "/")}:${src.slice(0, m.index).split("\n").length} :: ${trimmed.slice(0, 70)} :: [${digits.join(",")}]`);
    }
  }
}

console.log("scanned files=" + files.length);
console.log("hits=" + rows.length);
for (const r of rows) console.log(`${r.file}:${r.line} :: ${r.kind} :: ${r.text} :: [${r.words.join(",")}]`);
console.log("latin_digit_nodes=" + digitRows.length);
for (const r of digitRows.slice(0, 15)) console.log("  " + r);
