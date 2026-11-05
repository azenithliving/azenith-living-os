import { readFileSync, writeFileSync } from "node:fs";

/**
 * The currency code a customer can read: «EGP» is a machine spelling, «جنيه» is his word.
 *   node scratch/fix-currency-word.mjs            — say what would change, change nothing
 *   node scratch/fix-currency-word.mjs apply      — write it, then read the file back
 *
 * Every file is reported with its own count, and the write is only claimed after the bytes on disk
 * are re-read and counted again.
 */
const APPLY = process.argv[2] === "apply";
const FILES = ["lib/site-content.ts", "lib/site-config.ts", "app/start/page.tsx", "lib/constants/furniture-data.ts"];
const PATTERN = /(\d[\d.,]*\s*\+?\s*)(?:EGP|egp)\b/g;
const ONE = /(\d[\d.,]*\s*\+?\s*)(?:EGP|egp)\b/;

for (const file of FILES) {
  const before = readFileSync(file, "utf8");
  const hits = before.match(PATTERN) ?? [];
  const lines = before
    .split(/\r?\n/)
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => ONE.test(l));
  console.log(`\n${file} — ${hits.length} موضع في ${lines.length} سطر`);
  for (const [n, l] of lines) console.log(`  ${n}: ${l.trim().slice(0, 70)}`);
  if (!hits.length) continue;
  if (!APPLY) continue;
  // `$1` already carries the space that stood before the code, so the word follows it directly.
  const after = before.replace(PATTERN, "$1جنيه");
  writeFileSync(file, after, "utf8");
  const reread = readFileSync(file, "utf8");
  const left = (reread.match(/EGP/g) ?? []).length;
  const now = (reread.match(/(\d[\d.,]*\s*\+?\s*)جنيه/g) ?? []).length;
  console.log(`  كتبت ${hits.length} → المخزن الآن ${now} بصيغة «جنيه»، وباقي EGP = ${left}`);
}
