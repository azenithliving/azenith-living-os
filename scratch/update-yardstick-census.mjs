import fs from "node:fs";
const P = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const ar = (n) => String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
const src = fs.readFileSync(P, "utf8");
const lines = src.split(/\r?\n/);
let hit21 = 0, hit19 = 0;
for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  if (/^٢١\. /.test(L)) {
    hit21++;
    lines[i] = L.replace(/— \*مبني — بلا دليل\* — .*$/,
      "— *مبني — بلا دليل* — " +
      "مقاس من السجل نفسه " + ar("2026-10-19") + ": " + ar(8969) + " صورة نشطة، و" + ar(4) +
      " طرز، و" + ar(16) + " نوع غرفة — يعني " + ar(59.8) + "٪ من العدد المتفق عليه، والبنك زاد عن آخر قياس (٦٬٥٩٣). " +
      "الناقص: باقي الصور، و" + ar(16) + " غرفة مقابل " + ar(10) + " غرفة متفق عليها = مسميات زيادة في البنك.");
  }
  if (/^١٩\. /.test(L)) {
    hit19++;
    lines[i] = L.replace(/$/,
      " — **تكميل مقاس " + ar("2026-10-19") + ":** ذاكرة السرب فيها " + ar(20) + " سطراً، عليها متجه حقيقي " + ar(20) +
      " من " + ar(20) + " — يعني البحث بالمعنى بقى وراه مصدر بيكتب فعلًا. وذاكرة العميل " + ar(0) +
      " سطرًا الآن لأنكل قياس كان بيمسح سطره بنفسه، والدار لسه ما فتحتش على زائر حقيقي.");
  }
}
if (hit21 !== 1 || hit19 !== 1) { console.log("REFUSED: بند ٢١=" + hit21 + " بند ١٩=" + hit19); process.exit(1); }
const out = lines.join("\n");
const leak = out.match(/[一-鿿]/g);
if (leak) { console.log("REFUSED: CJK leak " + leak.slice(0, 5).join("")); process.exit(1); }
fs.writeFileSync(P, out);
console.log("بند ٢١=" + hit21 + " بند ١٩=" + hit19 + " written " + out.length);
