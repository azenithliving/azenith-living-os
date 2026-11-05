import fs from "node:fs";

/** Records the owner's voice proof, a refuted finding, and the measured scope of the next atom. */
const path = "C:/Users/noura/OneDrive/Desktop/أجتماع/محضر-الاجتماع.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const LATIN = { WHEN: when };

const toArabicDigits = (s) =>
  s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const lines = [
  "",
  "- **[وكيل المتجر] ({WHEN}):** **الصوت ثبت على موبايل المالك، ونتيجة اتسحبت مني بالقياس، والذرّة الجاية اتحجمت.**",
  "  **الصوت:** المالك رنّله بنفسه الساعة ٢:٢١ ص على الرابط المنشور وقال «الصوت طلع، تمام». كده صوت المتجر من السيرفر خرج من خانة «مبني بلا دليل» — وهي آخر حاجة كانت متوقفة على يده في المجموعة دي.",
  "  **نتيجة رجعت عنها:** من نفس الشاشة قرأت «آخر جولة يومية: قبل ١٦.٤ ساعة» وكتبتها «١٦٤ ساعة»، وفتحت ذرة «الجولة اليومية متأخرة أسبوع». سؤالي المباشر للقاعدة ردّ: آخر جولة نزلت ٢٠٢٦-١٠-٠٦ الساعة ٠٧:٠٠ بتوقيت المجدول، يعني ١٦.٦ ساعة، والحد اللي يقول «متأخرة» هو ٢٨ ساعة. المجدول شغال والشاشة بتقول الصح — الغلط كان في قراءتي، والنقطة العشرانية بين الأرقام العربية بتختفي في صورة الموبايل. اتسجّلت في المحضر وفي دفتر الدروس: أي رقم بيحسم نتيجة يُقرا من مصدره، مش من الصورة.",
  "  **حجم الذرّة الجاية بالقياس:** من ٨٥٦ رسالة مكتوبة من الموظفين، ٣٤ بتقول «نفّذنا/شغّلنا/فعّلنا» — منها ٣ بس اللي ملهاش سجل مكتب، ورسالة واحدة «كل حاجة تمام» من غير أي قياس. الطبقة التانية (٨٢ رسالة فيها «ناقد/مراجعة/صححه») ما ينفعش تُعدّ كذبًا بنفس المقياس: مراجعة الناقد مش مكتب بيتسجّل في عمود الأداة، فلازم الأول لها مصدر إثبات خاصها، وبعدين تتحسب.",
  "  **القرار:** الذرّة الجاية حدودها دي: أي كلام يقول «مكتب اشتغل» لازم يبقى وراه سجل مكتب، وإلا يتبدّل بسطر صادق يقول إيه اللي ما اتعملش. مفيش تعديل على طبقة الناقد لحد ما يبقى ليها مقياس.",
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
