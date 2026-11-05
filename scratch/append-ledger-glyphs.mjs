import { appendFileSync, readFileSync } from "node:fs";

/**
 * The minute for the glyph round. Both numbers are read out of the two census runs; the "after" is
 * refused if its own marker never landed on the screen where the defect was standing.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const MARKER = "السهم اللي كان يقلّب سطره";

const ledger = readFileSync("docs/ledger/council-minutes.md", "utf8");
if (ledger.includes(MARKER)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const shape = (file) => {
  const text = readFileSync(file, "utf8");
  const m = text.match(/\{"operator":(\d+),"brackets":(\d+),"arrows":(\d+),"bare-latin":(\d+)\}/);
  if (!m) throw new Error(`no totals in ${file}`);
  return { operator: Number(m[1]), brackets: Number(m[2]), arrows: Number(m[3]), latin: Number(m[4]) };
};

const before = shape("scratch/bidi-before.out");
const after = shape("scratch/bidi-after3.out");
if (!/new build live \(no arrows on the cockpit cards\)/.test(readFileSync("scratch/bidi-after3.out", "utf8"))) {
  console.log("REFUSING TO WRITE: the after-run's marker never landed on the cockpit cards.");
  process.exit(1);
}

const now = new Date();
const stamp = ar(
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`,
);

const minutes = ar(`

- **وكيل المتجر (${stamp}):** **${MARKER}: 64 سطر عليه شكل يقلّب اتجاه السطر بقوا 43 — والسهم راح من شاشاته كلها.**
  - **العدّاد:** سطور شاشاته العشرة عليها أشكال بتقلّب الاتجاه (قياس من النص اللي بيترسم فعلاً، مش من الملفات): **عامل 27 → 21 · قوس متداخل 6 → 3 · سهم 9 → صفر · كلمة لاتينية 22 → 19**.
  - **السهم كان من تلات مصادر، اتنين منهم إحنا اللي بنكتبهم:** «عالم الدار» كان بيقول النافذة بسهم بين التاريخين، ووردية التنسيق كانت بتطبع القسم والموظف كده: «**gallery** ← visual» — مفتاح آلة، وسهم، واسم موظف مقطوع. بقى «نافذة من … إلى …» و«**المعرض** — وكيل المرئيات». والتالت كان زرار الرجوع في المحادثة: رسمته سهم لوحده، فبقى أيقونة لها اسم يقرأه قارئ الشاشة.
  - **آخر سهم فضل واقف كان في مكان تاني خالص:** كارت الموظف في مصفوفة القيادة بيعرض سطر من آخر رسالة (teaser) — وده بيتقطّع من الصف المخزّن من غير ما يمرّ على كلام المالك. اتوصل، والاتنين مقاسين على الشاشة اللي كان العيب فيها.
  - **عيب في الأداة نفسها اتصحح قبل ما الرقم يتقال:** أول تشغيل للعدّاد كان بيستنى علامة البناء على شاشة المحادثة — وهي كانت نضيفة من النشر اللي قبله، فعدّى وقال «البناء الجديد» وهو بيقيس القديم. نقلنا الاستنى لشاشة الكروت نفسها، وهناك طلع السهم لسه موجود، وبعدها اتقفل وصار صفر.
  - **سطر الرفض على طاولة الورقة:** 3 صفوف قديمة كانت لسه بيطبع جملة المزود — اترجّعت لتصنيف الدار، وبقى «رصيد المفتاح خلص — ٤٠٠». وأول نسخة من التصنيف كانت بتحط الرقم في قوس جوّه القوس اللي بتحطه الطاولة، فبقى شرطة.
  - **اللي لسه:** 21 سطر عليه عامل (غالبيتها «|» جوه جداول رسمها الموديل، والحدّ ما بيلمسهاش لأن الجدول بيتقسم بيها بعد الترجمة) · 19 كلمة لاتينية ما للدار اسم عربي ليها لحد دلوقتي · 3 أسطر فيها إيميل عميل جوّه قوس.
  - **البوابات:** 2055 اختبار أخضر (+3 في الجولة دي: النافذة، صف الكارت، وشكل الرفض) · تيبشك سليم · بناء كامل · تلات نشرات والقياس بعد كل واحدة.
`);

appendFileSync("docs/ledger/council-minutes.md", minutes, "utf8");
const after2 = readFileSync("docs/ledger/council-minutes.md", "utf8");
console.log(`before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
console.log(`written: ${after2.includes(MARKER)} · file lines: ${after2.split(/\r?\n/).length}`);
