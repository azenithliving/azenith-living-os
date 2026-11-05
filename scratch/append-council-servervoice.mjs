import fs from "node:fs";

/** Records the store's own voice. Numerals are generated, never typed. */
const path = "C:/Users/noura/OneDrive/Desktop/أجتماع/محضر-الاجتماع.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const LATIN = { WHEN: when, COMMIT: "9da4e17" };

const toArabicDigits = (s) =>
  s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const lines = [
  "",
  "- **[وكيل المتجر] ({WHEN}):** **المتجر بقى بيقرا بصوته — مبقاش معلّق بمزاج المتصفح.**",
  "  **الواقعة من شاشة المالك:** إعدادات موبايله تقول المحرك «Google» واللغة «العربية» وبيانات الصوت منزّلة (٤,٢ ميغابايت) — وكروم تاني بيعطي الصفحة **122 صوت ولا واحد فيهم عربي**. يعني الزرار اللي بنيتُه امبارح كان شغال على الورق وميت عنده. أي قدرة موجودة بس لما متصفح يقرر يكشفها دي مش قدرة.",
  "  **اللي اتعمل:** باب `/api/admin/speech` بيجهّز الصوت نفسه من صوت جوجل العام المجاني (مفيش مفتاح، مفيش كارت، مفيش حساب جديد) وبيقدّمه من عنواننا إحنا. ورا البوابة بتاعة المديرين زي كل أبواب `/api/admin`، وبينطق نفس النص اللي بيوصل لصوت الجهاز (تشكيل متشال، أرقام ينطقها)، ومرفوعش فوق كلام قصير عشان ما يتحولش لمرور مفتوح، ومفيش صفحة خطأ بتتسلل كأنها صوت.",
  "  **في الكابينة:** «صوت المتجر من السيرفر» بقى أول اختيار في القائمة، بيتستخدم لوحده تلقائيًا لما الجهاز مالوش صوت عربي، واختياره بيتحفظ على الجهاز ده. صوت الجهاز لسه ليه الأولوية لو موجود — لأنه بيشتغل من غير نت.",
  "  **القياس على المنشور (جلسة حقيقية من المتصفح):** الباب ردّ `audio/mpeg` بـ **55,104 بايت** لجملة الاختبار · نص فاضي → **400** · القائمة عرضت اختيارين · الاختيار اتحفظ وعلامة «المختار» ظهرت · صفر خطأ في الكونسول.",
  "  **عيبان في أدواتي اتسجلوا:** أول نسخة من مقياسي عدّت طلب الـ 400 المتعمد وبعدين لمّت أخطاء الكونسول، فحسبته كسر في الصفحة — ترتيب الفحص اتصلح. واختبار «تصعيد المهمة لوكيل» وقع في التشغيل الكامل وعدا لوحده: بيكلم موديل حقيقي على النت، فحكمه تحت الحمل إشاعة مش دليل (اتفتح كمهمة 40).",
  "  **الرقم:** 7 حرّاس جديد · الاختبارات 1654 خضرا و3 متخطّية · تيبشك سليم · بناء كامل (رجع صفر والقطعة موجودة على القرص) · منشور على {COMMIT}. **الباقي لسه لودانه:** هو يسمع صوت المتجر ويقول.",
  "",
];

const body = lines.map((l) => toArabicDigits(l)).map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => LATIN[k])).join("\n");
const allowed = Object.values(LATIN).join("");
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error(`Latin digits outside the tokens: ${strays.join(", ")}`);
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");
const latinWords = (body.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => !/speech|admin|audio|mpeg|COMMIT|Google|bytes/.test(w));
if (latinWords.length) throw new Error(`Latin words leaked: ${latinWords.join(", ")}`);
fs.appendFileSync(path, body, "utf8");
console.log("appended:", body.split("\n").length - 2, "lines");
