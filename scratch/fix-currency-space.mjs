import { readFileSync, writeFileSync } from "node:fs";

/**
 * The double space my own currency patch left behind: «5,500  جنيه» reads as a typing slip on a
 * premium surface.  Collapses any run of spaces before the currency word, and counts what is left.
 *   node scratch/fix-currency-space.mjs [apply]
 */
const APPLY = process.argv[2] === "apply";
const FILES = ["lib/site-content.ts", "lib/site-config.ts", "app/start/page.tsx", "lib/constants/furniture-data.ts"];

for (const file of FILES) {
  const before = readFileSync(file, "utf8");
  const hits = (before.match(/\s{2,}جنيه/g) ?? []).length;
  if (APPLY && hits) writeFileSync(file, before.replace(/\s{2,}جنيه/g, " جنيه"), "utf8");
  const reread = readFileSync(file, "utf8");
  const left = (reread.match(/\s{2,}جنيه/g) ?? []).length;
  console.log(`${file} — مواضع كانت مضاعفة: ${hits} · فاضل بعد الكتابة: ${left}`);
}
