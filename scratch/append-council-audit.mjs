import fs from "node:fs";

/**
 * Records the statistics-command atom and the dead audit desk it exposed.
 * Numerals are generated, never typed — see the note in append-council-publish3.mjs.
 */
const path = "C:/Users/noura/OneDrive/Desktop/أجتماع/محضر-الاجتماع.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const LATIN = { WHEN: when, COMMIT: "4272b19", COMMIT2: "75aace2" };

const toArabicDigits = (s) =>
  s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const lines = [
  "",
  "- **[وكيل المتجر] ({WHEN}):** **الإحصائيات بقت عربي — والقياس كشف إن دفتر سجل الأوامر ما اتكتب فيه سطر واحد من يوم عمله.**",
  "  **الأول (الطلب):** الأمر كان بيرد «Statistics for last 7 days» والأرقام كلها في كائن الشات ما بيعرضهوش — عنوان من غير خبر. بقى جملة عربية بأرقام المالك، وكل رسائل طبقة الأوامر (**٢٥ رسالة**) اتحوّلت لعربي، والغلط التقني بقى يروح لسجل السيرفر بدل وشه.",
  "  **العيب اللي طلع من نفس القياس:** على الرابط المنشور السؤال فضل يقول «مفيش أمر متسجّل» مرتين. مقيّس من الكتالوج: `no_update_allowed` كانت **قاعدة جدول من نوع «ممنوع دائمًا»** — وقاعدة الجدول بتتحقق مع الإدراج مش مع التعديل بس. النتيجة: الجدول **صفر صفوف من يوم اتعمل**، وكل أمر إداري فشل في كتابة سجله وسجل الإنتاج بيقول «violates check constraint»، والأمر اللي بيقرا منه محكوم عليه يقول «مفيش» للأبد.",
  "  **الحماية الحقيقية ما اتلمستش:** منع التعديل موجود في سياسة الصفوف (ترفض بكل الحالات)، والمسح ممنوع لأن مفيش سياسة مسح أصلًا. اللي اتشال هو الغلط مش الحرّاس — **وكلمة المالك كانت صريحة قبل أي حذف في القاعدة.**",
  "  **عيبان تانين نفس المرض:** هوية المستخدم البديلة في العقل الطبيعي صفر-كل-الأصفار، والمفتاح الأجنبي يرفضها → الأمر بلا صاحب بقى بيتسجّل من غير نسبة بدل ما يضيع. والمسار الاحتياطي للكتابة على القرص بيكتب في مجلد الكود المقروء-فقط على السيرفرلس → كان بيرمي استثناء ومحدش بيقراه؛ بقى يطبع السطر نفسه كسطر مراجعة واحد بيتبحث عنه.",
  "  **القياس الحيّ على المنشور:** أول سؤال سجل أمره، والتاني قراه: «آخر ٧ يوم: ٢ أمر — …» وبعدها «٣ أوامر». **العدد بيتزايد من الكتابة الحقيقية مش من كلام.** وبعدين الجملة اتظبطت على وزن العربي: «أمر واحد» و«أمران» و«٣ أوامر» و«١١ أمر».",
  "  **الرقم:** ١٧ حرّاس جديد · الاختبارات 1612 خضرا و3 متخطّية · تيبشك سليم · بناء كامل · منشور على {COMMIT} ثم {COMMIT2}.",
  "  **مفتوح:** 15 ورقة من غير أرقام · اسمين للأوضة الواحدة (34) · أبواب النموذج اللي لسه ما نزلتش لأرضية صفر المفاتيح (11) · 748 رسالة مخزّنة بحروف أجنبية.",
  "",
];

const body = lines
  .map((l) => toArabicDigits(l))
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => LATIN[k]))
  .join("\n");

/**
 * Every Latin digit left in the file must belong to a token that was substituted in after the
 * conversion (the timestamp and the commit hashes). Counting them instead of checking their identity
 * was its own bug — the totals disagreed for reasons that had nothing to do with a leak.
 */
const allowed = Object.values(LATIN).join("");
const runs = body.match(/[0-9]+/g) ?? [];
const strays = runs.filter((run) => !allowed.includes(run));
if (strays.length) throw new Error(`Latin digits outside the tokens: ${strays.join(", ")}`);
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");

fs.appendFileSync(path, body, "utf8");
console.log("appended:", body.split("\n").length - 2, "lines");
