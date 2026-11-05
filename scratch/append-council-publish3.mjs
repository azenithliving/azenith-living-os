import fs from "node:fs";

/**
 * Records the three-atom publish and its live measurements in the council's minutes.
 *
 * Arabic-Indic numerals are generated here, never typed: a hand-typed Arabic digit string has
 * dropped a character in this workspace before (this file said "40" where it meant "401"), and a
 * minutes entry with a wrong number is worse than none. Latin-technical fragments — colour
 * triplets, a commit id, an HTTP status — are held behind tokens so the conversion pass cannot
 * touch them, and the script refuses to write if any token is left or any digit leaked.
 */
const path = "C:/Users/noura/OneDrive/Desktop/أجتماع/محضر-الاجتماع.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");

const LATIN = {
  WHEN: when,
  CARD_BG: "rgb(20, 22, 28)",
  CARD_FG: "rgb(245, 245, 244)",
  COMMIT: "47262d7",
  DOOR_AUTH: "401",
  DOOR_OK: "200",
  DOOR_GONE: "404",
  MS_CARDS: "1,034ms",
  MS_FULL: "4,076ms",
};

const toArabicDigits = (s) =>
  s
    .replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)))
    .replace(/,/g, "٬");

const lines = [
  "",
  "- **[وكيل المتجر] ({WHEN}):** **التلات ذرات اتنشرت، وكل واحدة اتقاست على الرابط الحيّ بعد النشر، مش على جهازي.**",
  "  **1) كارت الجودة (كان مفتوح برقم 22):** الباب بيرد {DOOR_OK} والمساحة ما فضلتش ساقعة. ولا رقم اتكتب بحروف لاتينية: «ناجح=3 · فاشل=0 · مشروط=1 · نسبة النجاح=67٪ · مواد=1 · أثناء=1 · قبل تشطيب=0 · نهائي=1 · إجمالي: 3 فحص». **العدّاد الآلي للأرقام اللاتينية في الكارت رجّع صفر**، وعدد الدوران اللي ما بيخلصش صفر. الكارت اتصوّرتُه وبصّيت عليه بعيني.",
  "  **2) كابينة القيادة (كان مفتوح برقم 23):** قبل الإصلاح كانت تفتح باب لكل موظف — تسع أبواب. **القياس على الحيّ بعد النشر: صفر قراءة لكل موظف وقراءة مجمّعة واحدة**، والتسعة كروت كلها طلّعت آخر جملة عندها (9 من 9). الكروت ظهرت في {MS_CARDS} والأرقام اكتملت في {MS_FULL}. **كلمة «السيرفر» اتشالت من الشاشة** وعدّت من العدّاد الآلي. الباب الجديد موجود على الإنتاج وبيرد {DOOR_AUTH} لغير المسجّل — مش {DOOR_GONE} — يعني هو اتنشر فعلاً.",
  "  **3) الجزيرة البيضاء (كان مفتوح برقم 25):** الكروت بقت تسأل البيت عن لونه. **مقيس على الحيّ: خلفية الكارت {CARD_BG} ونصّه {CARD_FG}** — يعني فاتح على غامق، و**الزرّار اللي بحدود بقى باين** بعد ما كان نصّه بلون خلفيته. تلات حالات «وضع فاتح» متبقية في لوحة الصور اتشالت، وكل كلام أجنبي في اللوحة اتحوّل لمصري: «سجلات مكتبة الصور»، «شغّل حصاد الصور السحابي»، «مفتاح الوصول». **ولا كلمة آلة بتطلع على شاشته.**",
  "  **الحدّ الصريح في القياس التالت — مافيش ادعاء:** المقياس كان بيقول «الصفحة العامة فضلت فاتحة» وهو **راجع صفر كروت**، لأن صفحة معاينة الأقسام بتقرا جدول مش موجود (مفتوح برقم 28). **فبقاء الافتراضي فاتح محروس باختبار وحدة بس، ومش متقاس في متصفح.** مش هحسبه دليل.",
  "  **عيب جديد لقِيته وأنا بتبصّ على صورة الكابينة، واتسجّل برقم 29:** كارت مدير تشغيل المحتوى بيعرض آخر جملة عنده، والجملة دي من دالة تلخيص القدرات — **أرقام أجنبية وعلامات زائد وكلمات آلة في نصّها** (أسماء منصات ومجرى ملف). ده نفس مرض رقم 25 بس في مصدر تاني: **كلام مكتوب جوه الكود مش في الواجهة**، فالحرّاس اللي كانت شغالة ما كانش بيشوفه.",
  "  **الرقم المقاس بعد النشر:** الاختبارات 1482 خُضرا و3 متخطّية · البناء سليم · سجل النقل 20 من 493 ذرة اتنقلت و6 ماشية و1 ممسوحة · **الفرع والخط الحيّ والبوابة العامة كلُّه على نفس الكوميت {COMMIT}** · رجوع الذرتين السابقتين (رسم الأوضة 8 من 8 ومصفوفة الألوان 6 من 6) أخضر على نفس الرابط الحيّ.",
  "  **اللي سيبته مفتوح:** 15 ورقة من غير أرقام (شغل القارئ) · صفحة معاينة الأقسام (28) · كلام الموظف الأجنبي (29) · الأبواب اللي لسه ما نزلتش لأرضية صفر المفاتيح (11 و12) · زر النشر بتاع الأوامر بيقول «غير مصرّح» والنشر بيتم من الرفع للخط الحيّ.",
  "",
];

const body = lines
  .map((l) => toArabicDigits(l))
  .map((l) => l.replace(/\{([A-Z_]+)\}/g, (_, k) => LATIN[k]))
  .join("\n");

const leaked = (body.match(/[0-9]/g) ?? []).length;
const wanted = Object.values(LATIN).join("").replace(/[^0-9]/g, "").length;
if (leaked !== wanted)
  throw new Error(`digit leak: ${leaked} Latin digits in the body, ${wanted} expected inside technical fragments`);
if (/\{[A-Z_]+\}/.test(body)) throw new Error("an unreplaced token survived");

fs.appendFileSync(path, body, "utf8");
const all = fs.readFileSync(path, "utf8").split(/\r?\n/);
console.log("appended lines:", lines.length, "· minutes lines now:", all.length);
console.log("read-back of the first two appended lines:");
console.log(all.slice(-lines.length, -1).slice(0, 2).join("\n"));
