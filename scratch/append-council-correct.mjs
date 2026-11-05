import fs from "node:fs";

/** Corrects the record: the alert station works; my instrument was blind. */
const path = "C:/Users/noura/OneDrive/Desktop/أجتماع/محضر-الاجتماع.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const LATIN = { WHEN: when, COMMIT: "b6dd046" };

const toArabicDigits = (s) =>
  s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const lines = [
  "",
  "- **[وكيل المتجر] ({WHEN}):** **تصحيح سجلّ الليلة: محطة التنبيه شغّالة — والقارئ الأعمم كان أنا.**",
  "  **الغلط:** قلت للمالك «التنبيه ما ختمش الورقة». سؤالي المباشر للقاعدة ردّ: الورقة التجريبية (رقم ١١٧) مختومة ٢٠٢٦-١٠-٠٧ الساعة ٠٢:١٥:٥٣ — يعني ٨٧ ثانية بعد ما اتعملت. الآلة كانت بتقرا الختم من ردّ صفحة العميل، والردّ ما فيهوش هذا أصلاً (مش حقّه يقرأه). فكل «فاضي» طلع من آلة عميا، مش من النظام.",
  "  **الإثبات التاني:** باب الاختبار بتاع التطبيق نفسه بعت رسالتين حقيقيتين على رقميه — رقم رسالة ٧٥٠ و٧٥١ — والمالك قال «وصلت». فالسلسلة كاملة: تصويت تانى → ساخن جداً → رسالة → ختم مرة واحدة.",
  "  **اللي اتصلّح فعلاً ونُشر ({COMMIT}):** مفتاح «التنبيهات شغّالة» كان بيتقرا من اسم متغيّر مش موجود عند النشر، فلما قراءة اللوحة تفشل يرجع «مقفول» ويسكت من غير ما يقول سبب. بقى: اللوحة هي الحكم (مقفول بس لو صراحة مقفول)، وكل سكوت بيقول ليه — مفيش مفتاح / مقفول / مفيش حساب. ٣ حرّاس · ١٧٣١ اختبار أخضر · تيبشك · بناء كامل.",
  "  **الفاضل من الرحلة كما هو متقاس:** الورقة ما تتقفلش لأن قارئ صور جوجل مرفوض (٤٠٣ — مشروع محروم) · العميل ملوش باب على جوازه (صفر رابط في صفحة الطلب) · صفحة الطلب بتتكلم إنجليزي للعميل · محددات القياس: محطة الدخول آلتی سجلت اختيار واحد من أربعة (عيب آلة).",
  "  **القاعدة اللي اتسجلت في الدفتر:** أي إثبات بيتقاس من مصدر ما بيحتويهوش بيتحوّل لـ«غير موجود» — عيب آلة تالت النهارده (بعد مقياس يحسب النص مع الأدلة، ومقياس يحكم بـ«صفر مخالفة» قدام المخالفة).",
  "",
];

const body = lines.map((l) => toArabicDigits(l)).map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => LATIN[k])).join("\n");
const allowed = Object.values(LATIN).join("");
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error(`Latin digits outside the tokens: ${strays.join(", ")}`);
const latinWords = (body.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !/commit|COMMIT/.test(w));
if (latinWords.length) throw new Error(`Latin words leaked: ${latinWords.join(", ")}`);
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");
fs.appendFileSync(path, body, "utf8");
console.log("appended:", body.split("\n").length - 2, "lines");
