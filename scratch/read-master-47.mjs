import fs from "node:fs";

/** Prints the tail of master-list item 47 exactly as the file holds it, so an anchor can be copied. */
const path = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const text = fs.readFileSync(path, "utf8");
const line = text.split(/\r?\n/).find((l) => l.startsWith("٤٧."));
if (!line) {
  console.log("سطر ٤٧ مش موجود");
  process.exit(1);
}
console.log("الطول:", line.length);
console.log("آخر ١٢٠ محرف:", JSON.stringify(line.slice(-120)));
const probe = "اشتغل";
const i = line.indexOf(probe);
console.log("موضع «اشتغل»:", i, i >= 0 ? JSON.stringify(line.slice(i - 40, i + 40)) : "");
