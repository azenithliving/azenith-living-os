import fs from "node:fs";

/** Records the decided-status fix. Numerals are generated, never typed. */
const path = "C:/Users/noura/OneDrive/Desktop/أجتماع/محضر-الاجتماع.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const LATIN = { WHEN: when, COMMIT: "1a0d7bb" };

const toArabicDigits = (s) =>
  s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const lines = [
  "",
  "- **[وكيل المتجر] ({WHEN}):** **اللي اخد قرار بقى يقرأ نتيجته، مش «مفيش قرار معلّق».**",
  "  **الواقعة:** بعد ما المالك دوس «ارفض» تحت الرسالة، البلوك نفسه رجع قال «مفيش قرار معلّق بهذا الرقم». صحيح بالنسبة لطابور المستني، بس بيقول له إن الرسالة بايظة، وبيخفي الحاجة اللي هو عملها. السبب: باب الطابور كان بيرد بالمعلّق بس.",
  "  **الإصلاح:** الباب بقى يرد على صف واحد برقمه أيا كانت حالته، والبلوك يقرا صفّه هو بدل ما يمشي على الطابور كله، والأزرار تظهر وهو لسه مستني. المتخاذ يقول «اتقفل: اترفضت» أو «اتنفذت» — لأن قرار اختفى من الشاشة قرار ما ينفعش يوثق فيه.",
  "  **القياس على المنشور:** الرسالة القديمة اللي رفضتها التجربة بقت «القرار ده اتقفل: اترفضت · درجة الخطورة: حرجة» بصفر أزرار، وقرايات الباب كلها رجعت 200.",
  "  **رقم الاختبارات:** 3 حرّاس جديد · الاختبارات 1657 خضرا و3 متخطّية · تيبشك سليم · بناء كامل رجع صفر والقطعة على القرص · منشور على {COMMIT}.",
  "  **عيب مني اتسجّل:** كوميت ده اتكتب تحت عنوان كوميت قبله (الراداد بتاع الشارة). محضر الغرفة ده آخر مرة يكتب فيها عنوان منسي — الحارس بقى آلي: سكريبت مقارنة يقارن أول ست كلمات من العنوان الجديد بآخر تلاتين عنوان ماضيين ويرفض لو في تكرار.",
  "",
];

const body = lines.map((l) => toArabicDigits(l)).map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => LATIN[k])).join("\n");
const allowed = Object.values(LATIN).join("");
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error(`Latin digits outside the tokens: ${strays.join(", ")}`);
const latinWords = (body.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => !/check|commit|COMMIT/.test(w));
if (latinWords.length) throw new Error(`Latin words leaked: ${latinWords.join(", ")}`);
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");
fs.appendFileSync(path, body, "utf8");
console.log("appended:", body.split("\n").length - 2, "lines");
