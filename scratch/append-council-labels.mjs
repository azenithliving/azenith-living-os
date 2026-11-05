import fs from "node:fs";

/** Records the store-labels atom. Numerals are generated, never typed. */
const path = "C:/Users/noura/OneDrive/Desktop/أجتماع/محضر-الاجتماع.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const LATIN = { WHEN: when, COMMIT: "74c6806" };

const toArabicDigits = (s) =>
  s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const lines = [
  "",
  "- **[وكيل المتجر] ({WHEN}):** **كلام الآلة ياخد اسمه العربي عند المكتب، مش عند الشاشة.**",
  "  **الحصر:** بعد طبقة الصوت فضل ٤٠ كلمة لاتينية على شاشة المالك، ورجّعت كلّها جوّه رسائل بتردّد على أداة: «الحالات: confirmed 2» من عالم الدار (عمود الحالة بيتقرى خام)، و«image_fix — curate_gallery — /#kitchens» من مكتب المسودات (نوع المسودة ومسارها الخام)، وأسماء فحوص إمكانية الوصول من مخرَج الأداة.",
  "  **الإصلاح:** ملفين تسمية: حالة الطلب (متأكّد، قيد التجهيز، مكتمل، ملغي، ارجعت الفلوس…) ونوع المسودة ومكانها (تصحيح الصورة، تنظيم المعرض، نص الواجهة، قسم المطابخ، صفحة منتج). القاعدة مش حفظ قيم: أي كلمة تحتها شرطة سفلية هي معرّف آلة بشكلها — ليها اسم عربي في قائمة القدرات يتقال، ومالهاش تتسكت. والبروتوكول اللي بيوجّه كل موظف بقى يقول صراحة: ما تكتبش حرف أو رقم لاتيني في ردّك، واسم جدول أو حقل ما يتكتبش في الكلام — وسطر الأدلة بقى يطلب «رابط الدليل» بدل ما يعلّم الموديل يكتب اسم الحقل اللاتيني (ده كان مصدر ١٢٢ مرة من الاسم على شاشته).",
  "  **القياس على بياناته الحقيقية:** المكتبان اتشغّلا فعليًا على قاعده: «المسودات المعلقة: ٤ — صفحة منتج — تصحيح الصورة — الإصدار ١ — منذ ١٢ يوم» و«الحالات: متأكّد ٢» — صفر كلمة لاتينية في النتين. وعلى المنشور: من ١٥٩ كلمة لاتينية في محادثته لـ ١٢ (ناقص ٩٢٪)، وصفر للاسم المتقاعَد، وصورة الشاشة متبصّ عليها، ودورة نوار بصفر خطأ كونسول.",
  "  **اللي فضل ومالهش داعي يتحارب:** VIP (جزء من اسم المنتج اللي العميل نفسه اختاره)، و Vercel و Genesis (أسماء معرفة)، وتلات كلمات جوّه صفوف قديمة اتكتبت قبل الإصلاح — الجديد من المكتب يطلع عربي من أصله.",
  "  **رقم الاختبارات:** ٤٠ حرّاس في الطبقتين (٢٦ صوت + ١٤ تسمية) · الاختبارات ١٧١١ خضرا و٣ متخطّية · تيبشك سليم · بناء كامل رجع صفر · ثلاث نشرات آخرها {COMMIT}.",
  "",
];

const body = lines.map((l) => toArabicDigits(l)).map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => LATIN[k])).join("\n");
const allowed = Object.values(LATIN).join("");
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error(`Latin digits outside the tokens: ${strays.join(", ")}`);
const latinWords = (body.match(/[A-Za-z]{2,}/g) ?? []).filter(
  (w) => !/commit|COMMIT|confirmed|image|fix|curate|gallery|kitchens|Vercel|Genesis|VIP|apps|app/.test(w)
);
if (latinWords.length) throw new Error(`Latin words leaked: ${latinWords.join(", ")}`);
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");
fs.appendFileSync(path, body, "utf8");
console.log("appended:", body.split("\n").length - 2, "lines");
