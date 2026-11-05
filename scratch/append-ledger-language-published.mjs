import fs from "node:fs";

/**
 * The published-site gate for the language atom: the minute said "pending" — it is no longer.
 *   node scratch/append-ledger-language-published.mjs
 */
const AI = (s) => String(s).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const MARK = "**اللي معلّق:** التعديلين دول";
const NEW = AI(
  `  - **النشر والدليل على الرابط المنشور (2026-10-09):** العُطل كان في الجهاز نفسه — أداة الأوامر بتاعت الجلسة عجزت تنزّل نسخة چيت كاملة والتركيب الموجود على القرص كان ناقص (مفيش وسيلة نقل ولا حارس كلمات سر). المالك أذن بالتركيب، فنزّلنا النسخة المحمولة الرسمية (توقيعها سليم: Johannes Schindelin) وشغّلناها من مجلد التنزيلات، والرفع مشى: 4 محفوظات نزلت على فرع الإنتاج. وبعدين القياس التلات نفسه اتعاد على الرابط الحيّ بنفس النتيجة: زائر عربي جديد → الشاشتين بالعربي واتجاه rtl · الرابط قال إنجليزي → الشاشتين بالإنجليزي واتجاه ltr · زرار اللغة اتضغط في المسار → المسار اتغير والكراسة لقته متغير. صور المسارين اتبصّيت عليها، وصفر خطأ في طرفية المتصفح.`,
);

const path = "docs/ledger/council-minutes.md";
const text = fs.readFileSync(path, "utf8");
const lines = text.split(/\r?\n/);
const hits = lines.map((l, i) => (l.includes(MARK) ? i : -1)).filter((i) => i >= 0);
if (hits.length !== 1) throw new Error(`علامة السطر موجودة في ${hits.length} سطر بدل واحد — ما اتكتبش`);
lines[hits[0]] = NEW;
fs.writeFileSync(path, lines.join("\n"), "utf8");
console.log("محفوظ:", fs.readFileSync(path, "utf8").includes("النشر والدليل على الرابط المنشور") ? "نعم" : "لأ");
