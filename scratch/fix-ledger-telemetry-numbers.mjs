import { readFileSync, writeFileSync } from "node:fs";

/**
 * Two numbers in the minute were imprecise against the census they quote: the stale telemetry table
 * is 1354 + 26 rows, not 1210, and its newest activity is 11 August (the kernel rows), not 21 April
 * (the gateway rows). Corrected from the printed census, written in Latin digits and converted, so no
 * Arabic-Indic character can be lost by the editor.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));

const file = "docs/ledger/council-minutes.md";
const text = readFileSync(file, "utf8");

const from = ar("«تليمتري النظام» 1380 سطر بس كلهم من آلة قديمة ساكنة من 21 أبريل (1210 منهم «بوّاب أبعاد» و26 «نواة»)");
const to = ar("«تليمتري النظام» 1380 سطر من آلة قديمة: 1354 منها «بوّاب أبعاد» وآخر سطر ليها 21 أبريل، و26 سطر «نواة» آخرها 11 أغسطس");

const hits = text.split(from).length - 1;
if (hits !== 1) {
  console.error(`expected exactly 1 occurrence, found ${hits}`);
  process.exit(1);
}

writeFileSync(file, text.replace(from, to), "utf8");

const after = readFileSync(file, "utf8");
const line = after.split("\n").find((l) => l.includes("تليمتري النظام» ١٣٨٠"));
console.log("replaced = 1");
console.log(line ? line.slice(0, 260) : "line not found after write");
