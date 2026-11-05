import { readFileSync, writeFileSync } from "node:fs";

const p = "scratch/append-council-m1.mjs";
let s = readFileSync(p, "utf8");

const subs = [
  ["و${AR(2)} منهم", "و${AR(T.CRON_SCHEDULED)} منهم"],
  ["وصول ${AR(18)} قطعة", "وصول ${AR(T.FURNITURE)} قطعة"],
  ["أول تصنيف قال ${AR(0)} باب ليه توأم", "أول تصنيف قال إن ولا باب ليه توأم"],
];

for (const [from, to] of subs) {
  const hits = s.split(from).length - 1;
  if (hits !== 1) throw new Error(`anchor «${from}» matched ${hits} times`);
  s = s.replace(from, to);
}

writeFileSync(p, s, "utf8");
console.log("patched", subs.length);
