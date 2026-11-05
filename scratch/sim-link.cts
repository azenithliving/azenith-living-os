import { splitEmphasis } from "@/lib/talk/emphasis";
const cells = [
  "[(رابط غير موثق)]()",
  "| ١ | منتج (صوفا ملكية) بلا صورة رئيسية | [(رابط غير موثق)]() | ارفع صورة فوراً |",
];
for (const c of cells) {
  console.log(JSON.stringify(c));
  console.log("  →", JSON.stringify(splitEmphasis(c)));
}
