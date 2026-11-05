import fs from "node:fs";

/** Records the honesty-guard atom and the negative result that blocks it. */
const path = "C:/Users/noura/OneDrive/Desktop/أجتماع/محضر-الاجتماع.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const LATIN = { WHEN: when, COMMIT: "b3634a8" };

const toArabicDigits = (s) =>
  s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const lines = [
  "",
  "- **[وكيل المتجر] ({WHEN}):** **الناقد بقى يعرف الحقيقة، والقياس الحيّ كشف إن الأرض اللي بتتحكم عليها مش موجودة.**",
  "  **اللي اتعمل:** الناقد الداخلي كان بيشوف السؤال والردّ بس — مستحيل يمسك «فعّلنا الأدوات» لأنه ما بيعرفش ولا مكتب اتفعّل. بقى ياخد الحقيقة دي في نص الفحص، ولو الرد ادّعى تنفيذ خلافها دي أول عيب يصلحه. وفي حدود الكتابة: أي جملة بتقول «نفّذنا/شغّلنا/تم تنفيذ» من غير سجل مكتب بتتمحي، وأي ردّ بيبان كأنه دليل (جدول أو كلام حالة وفحص) وهو من غير مكتب بيتحط له سطر «مفيش مكتب اتشغّل في الطلب ده». ١٦ حرّاس · ١٧٢٨ اختبار أخضر · منشور {COMMIT}.",
  "  **النتيجة السالبة (دي الأهم):** عيّنة محادثته بعد النشر: ٥ صفوف مكتوبة من الموظفين، الخمسة سجلهم فاضي خالص — لا اسم مكتب ولا نتيجة — ومنهم اتنين شغّلوا مكتب المسودات فعلاً (السطر فيه توكن معاينة حقيقي و«تم — ١ تغيير جاهز»). يعني الرد اللي صدق والرد اللي كدب بيبانوا عندنا بنفس الشكل بالظبط. الحرّاس سكتت على سطر «تم» لأنه ملقاش سجل يقارن بيه.",
  "  **القرار:** مش هوسّع الشبكة تاني. أي توسيع دلوقتي هيسمّي شغل حقيقي «غير مقاس» — ودي كدبة في الاتجاه العكسي، وأخطر من اللي بنصلحه. الذرّة اللي قبلها: كل صف في المحادثة يقول مكتبه مين ونتيجته إيه، وبعدين حرّاس الصدق تقف على أرض.",
  "  **عيب آلة اتسجّل:** أول مقياس للذرّة دي حكم بـ«صفر مخالفة» وهو قدام سطر «تم — ١ تغيير جاهز»، لأن الحكم كان «يوجد جدول» بس — مقياس بيشوف شكلاً واحداً مش كل أشكال الدليل. اتبدّل بمسار تشخيص (من أي باب كتبوا الصف) بدل توسيع حدسي.",
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
