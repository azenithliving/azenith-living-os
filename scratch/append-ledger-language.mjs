import fs from "node:fs";

/** Records the customer-page language census in the repository ledger. Numerals generated. */
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const AI = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const lines = [
  "",
  `- **وكيل المتجر (${when}):** **حصر لسان شاشات العميل على المنشور.**`,
  "  - **المقياس:** سبع عناوين من الموقع على عرض ٣٩٠ بلغة عربية. كلها صحيحة اللغة والاتجاه (عربي، يمين-شمال)، والفاضل كلمات لاتينية بالاسم: الرئيسية ٥ (DISCOVERY و Search Hub) · صفحة الطلب ١٧ (Interactive Project Brief Builder و Layouts و Moodboards و BOQ و PROPERTY) · الأثاث ٢٢ (منها كود العملة ١٨ مرة — يعني الأسعار بتتكتب بكود العملة مش «ج.م» زي باقي الشاشات) · البداية والغرف ومن نحن صفر.",
  "  - **ملاحظة جانبية:** عنوان الحجز يطابق عنوان الطلب حرفياً في المحسوب (١٤١٠ حرف ونفس الكلمات) — عنوانان لنفس الصفحة، بيتسجلش بيتلم.",
  "  - **القرار:** الإصلاح على ثلاث رقع: عنوان صفحة الطلب وتسميات أقسامها، كود العملة في الأثاث، وتسميتي الرئيسية. القياس بعدها بنفس الآلة، والمستهدف صفر كلمة لاتينية في النص (العناوين المعروفة والروابط مستثناة).",
  "",
];

const body = AI(lines.join("\n"));
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !when.includes(r));
if (strays.length) throw new Error(`Latin digits left: ${strays.join(", ")}`);
fs.appendFileSync("docs/ledger/council-minutes.md", body, "utf8");
console.log("appended:", lines.length - 2);
