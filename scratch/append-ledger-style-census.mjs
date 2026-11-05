import fs from "node:fs";

/**
 * Records the style-chart census — a measurement, not a change. Numerals are generated.
 *   node scratch/append-ledger-style-census.mjs
 */
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const AI = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const lines = [
  "",
  `- **وكيل المتجر (${when}):** **جرد سريع لرسومات الطراز: الرقم اللي بتعرضه اللوحة دلوقتي مش طرازين، هو تمانية — وأكبرهم اسم صفحة.**`,
  "  - **مقياس من السجل نفسه (قراءة بس، من غير ما نلمس سطر):** 30 سطر زائر. اللوحة بتجمع خانة الطراز كما هي، فبتطلع 8 أنواع: «elite-brief» بـ14 سطر (اسم الشاشة، محسوب طراز)، و«مودرن» بـ3 و«مودرن (Modern)» بـ2 و«modern» بـ1 — يعني طراز واحد متقسم تلات أنواع — و«نيوكلاسيك» بـ3 و«كلاسيك» بـ1 (واحد كمان متقسم)، و«هادئ فاخر» بـ2 (ده كلام العميل فعلًا)، و4 فاضي. بنفس السطور من طريق قارئ الذوق بتاع المتجر: مودرن 6 · كلاسيك 4 · كلام العميل اللي مفيش صورة تطابقه 2 · ومرفوض 18 (14 اسم صفحة + 4 فاضي).",
  "  - **القرار اللي طلع من الجرد:** الإصلاح في مكان التجميع (لوحة الأرقام)، مش في السجل. أي رقم طراز يتقال قبل الإصلاح ده يتقال إنه مقياسين الاتنين، مش واحد.",
  "  - **سجل تاني:** سطور عليها منطقة وطراز مع بعض بقت 4 (كانت 3 النهاردة قبل مشوار مسار النخبة).",
  "",
];

const body = AI(lines.join("\n"));
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !when.includes(r));
if (strays.length) throw new Error(`Latin digits left: ${strays.join(", ")}`);
fs.appendFileSync("docs/ledger/council-minutes.md", body, "utf8");
console.log("appended:", lines.length - 2, "lines");
