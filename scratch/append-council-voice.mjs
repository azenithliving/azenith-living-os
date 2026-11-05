import fs from "node:fs";

/** Records the Arabic-voice atom. Numerals are generated, never typed. */
const path = "C:/Users/noura/OneDrive/Desktop/أجتماع/محضر-الاجتماع.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const LATIN = { WHEN: when, COMMIT: "2a6ae03" };

const toArabicDigits = (s) =>
  s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const lines = [
  "",
  "- **[وكيل المتجر] ({WHEN}):** **تقارير الموظفين بقت تُقرأ بعربيّته على شاشته — والحصر قبل الإصلاح وبعده.**",
  "  **الحصر:** محادثة المدير فيها ٨٥١ رسالة مكتوبة من الموظفين، ٧٣٦ منها فيها كلمات لاتينية. منها ٦٨١ عبارة عربية سليمة لكن اتوسّطها اسم آلة («النتيجة العامة: Pass»، «رابط التفاصيل: evidenceUrl»)، و١٠٠ رسالة لاتينية في معظمها لأن أداة ردّت بالإنجليزي («تحليل الظهور خلّص — Score: 97/100»، «سرعة الصفحة API 429: Too Many Requests»)، و٩١ رسالة ناطرة باسم الأداة المتقاعَد (qayyim_world و qayyim_rivals) — وده اسم مات في ٢٠٢٦-٠٩-٢٨ ولازم ما يرجعش على شاشة المالك.",
  "  **الإصلاح:** صوت المالك اتكتب في ملف لوحده، وشغّال عند رسم الفقاعة — مش عند التخزين: التاريخ اللي اتكتب قبل كده ما بيتّمحيش، بس بقى يقرا. الأرقام اللاتينية تتحوّل لأرقامه، أسماء التقارير المعروفة تتعرّب، ومفتاح الآلة يتحوّل لاسم الأداة العربي اللي القائمة نفسها بتعطيه — واللي ما لوش اسم عربي بيتسكت عنه، والسكوت أحسن من كلمة يفكّها. الرابط ومسار الموقع وكود النسخ يمشوا زي ما هما (العربية عنده تسمح بعنوان ويب كعنصر لوحده). ومن مصدر الكلام: سطر أداة الظهور وسطر فشل سرعة الصفحة بقوا بالعربي، لأن اللي بيترجم للموديل لازم ما يشوفش إنجليزي يردّده.",
  "  **عيب في المقياس اتصحّح وانبان:** أول مقياس حسب كل كلمة لاتينية على الشاشة، وطلع ١٥٩ → ٩٢ (ناقص ٤٢٪) ووقع في حدّ السبعين. الغلط كان في المقياس مش في الإصلاح: عدّاد واحد بيحسب النص مع الأدلة (روابط، قيم ترويسات جوّه كود). فصلتهم: النص وحده، والدليل وحده — وده تعريف عدّاد غيّرته بعد ما شفت الرقم، فمُسجَّل هنا صراحةً. بعد التصحيح ده والتوسعة التانية والتالتة: ١٥٩ → ٤٠ (ناقص ٧٥٪)، وصفر مرة للاسم المتقاعَد على الشاشة.",
  "  **القياس على المنشور:** الحزمة المنشورة فيها العبارات الجديدة، «النتيجة العامة: ناجح»، وأرقامه ظاهرة، ودورة نوار كاملة بصفر رسالة خطأ في الكونسول. اللي فضل (٤٠) كلّه من قوالب التقارير نفسها: عناوين أداة الوصول («Keyboard Navigation»، «Contrast Ratio») ومسارات آلة («gscqueries»، «draftlist»، «hero») — وده الذرّة الجاية: القالب يتعرّب من جوه، مش يتترجم وهو طالع.",
  "  **رقم الاختبارات:** ٢٤ حرّاس جديد · الاختبارات ١٦٩٥ خضرا و٣ متخطّية · تيبشك سليم · بناء كامل رجع صفر · منشور على {COMMIT}.",
  "",
];

const body = lines.map((l) => toArabicDigits(l)).map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => LATIN[k])).join("\n");
const allowed = Object.values(LATIN).join("");
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error(`Latin digits outside the tokens: ${strays.join(", ")}`);
const latinWords = (body.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => !/commit|COMMIT|Keyboard|Navigation|Contrast|Ratio|evidenceUrl|qayyim|gscqueries|draftlist|hero|world|rivals|Score|Pass|Too|Many|Requests|PageSpeed|API/.test(w));
if (latinWords.length) throw new Error(`Latin words leaked: ${latinWords.join(", ")}`);
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");
fs.appendFileSync(path, body, "utf8");
console.log("appended:", body.split("\n").length - 2, "lines");
