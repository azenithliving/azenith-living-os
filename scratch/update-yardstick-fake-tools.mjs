import { readFileSync, writeFileSync } from "node:fs";

const P = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const ar = (n) => String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
const FOREIGN = new RegExp("[\\u3000-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af\\uf900-\\ufaff\\u0590-\\u05ff]");

const add =
  " — **تكميل مقاس " + ar("2026-10-19") + " بالليل:** أداة «اعمل نسخة احتياطية» اتقيست وهي وهمية: أربع من جداولها " + ar(6) +
  " مش موجودة، والجدول اللي بتقول إنها بتكتب فيه مش موجود، ومحادثة المالك ما كانش في نطاقها، وبتحط عنوان تحميل **عام** لبياناته، وبتختم «التحقق تم» من غير تحقق. " +
  "اتشالت واتحوّلت لنفس الوحدة المقيسة، و اتشالت منها مقابض بتعلنها وما بتنّفذش. **وأكذب منها:** باب الأدوات كان بيردّ «نجح» حتى لما طلب الموافقة يفشل — بقى بيردّ ٥٠٠ ويقول السبب. " +
  "الحارس: " + ar(8) + " اختبارات جديدة على الوحدة والباب، والقياس الحيّ " + ar(16) + " من " + ar(16) + ".";

const lines = readFileSync(P, "utf8").split("\n");
let hit = 0;
for (let i = 0; i < lines.length; i++) {
  if (!/^٤٧\. /.test(lines[i])) continue;
  hit++;
  lines[i] = lines[i].replace(/\s+—\s+\*\*تكميل مقاس .*$/, "") + add;
}
if (hit !== 1) {
  console.log("مرفوض: البند اتلاقى " + hit + " مرة");
  process.exit(1);
}
const out = lines.join("\n");
const item = out.split("\n").find((l) => l.startsWith("٤٧. ")) ?? "";
const bare = item.split("`").filter((_v, k) => k % 2 === 0).join("");
const latin = [...new Set(bare.match(/[A-Za-z]{2,}/g) ?? [])];
if (latin.length) {
  console.log("مرفوض: لاتيني: " + latin.slice(0, 8).join(","));
  process.exit(1);
}
if (FOREIGN.test(item)) {
  console.log("مرفوض: حرف مش عربي");
  process.exit(1);
}
writeFileSync(P, out);
console.log("البند ٤٧ اتزاد له التكميل المقيس");
