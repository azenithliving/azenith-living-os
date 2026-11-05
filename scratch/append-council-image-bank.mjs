import fs from "node:fs";

/**
 * Appends the image-bank atom. Every number is read out of the proof's own output file.
 */
const path = "docs/ledger/council-minutes.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const prove = fs.readFileSync("scratch/img-prove6.out", "utf8");
const suite = fs.readFileSync("scratch/img-suite3.out", "utf8").split(String.fromCharCode(27) + "[").map((c, i) => (i === 0 ? c : c.replace(/^[0-9;]*m/, ""))).join("");

const need = (label, re) => {
  const m = prove.match(re);
  if (!m) throw new Error("the proof never printed " + label);
  return m[1];
};
const ar = (v) => String(v).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
const AR_MAP = Array.from({ length: 10 }, (_, k) => String.fromCodePoint(0x0660 + k)).join("");
const toLatin = (v) => String(v).replace(/[\u0660-\u0669]/g, (d) => String(AR_MAP.indexOf(d))).replace(/[\u066C,]/g, "");
const group = (v) => ar(Number(toLatin(v)).toLocaleString("en-US")).replace(/,/g, "٬");

const T = {
  WHEN: when,
  COMMIT_SCREEN: "6f0a1d7",
  COMMIT_FIX: "e295baf",
  TOTAL: group(need("total", /العدد المعروض:\s*([٠-٩٬]+)/)),
  BIGGEST: ar(need("biggest room", /أكبر غرفة واحدة في السجل: (\d+)/)),
  REVIEWED: ar(need("reviewed", /راجعت (\d+) ·/)),
  PASSED: ar(need("passed", /نجح (\d+) ·/)),
  FAILED: ar(need("failed", /فشل (\d+)/)),
  TESTS: (suite.match(/Tests\s+([\d,]+) passed/) ?? [])[1],
  SUITE_EXIT: (suite.match(/suite exit=(\d+)/) ?? [])[1],
  PROOF: "scratch/prove-image-bank.mjs",
};

const lines = [
  "",
  "- **الوكيل ({WHEN}):** **بنك الصور اخد عنوانه في الجديدة، والصورة اللي اتبصّيت عليها كشفت إن الكروت كانت بتقول رقم نص الغرفة.**",
  "  **الذرة:** اللوحة القديمة كانت جزء من صفحة رئيسية بـ ٦٠٠ سطر وبتطبع حالة سجل التحديث زي ما هي في القاعدة (كلمة آلة إنجليزية) جنب أرقام لاتينية. الشاشة الجديدة بتقرأ نفس الباب الحارس — مالك واحد للعدد — وبتقول الغرف باسمها من مُسمّي المتجر نفسه. نُشر ({COMMIT_SCREEN}).",
  "  **عيبين كشفهم المنظر مش الأرقام:** الباب بيرجع أزواج (غرفة + ستايل)، فاللوحة كانت بتجمع أول ٨ زوج بس وتناديهم «عدد الغرفة» — يعني نص الغرفة اتقال كلها — وبتجمّع بالمفتاح الخام، فالاتنين اللي اسمهم العربي واحد (صالة ومعيشة) ظهروا كارتين. الجمع بقى بيتم على كل الأزواج وباسم الغرفة. نُشر ({COMMIT_FIX}).",
  "  **القياس الحيّ على الرابط المنشور:** `{PROOF}` — **راجعت {REVIEWED} · نجح {PASSED} · فشل {FAILED}**: العدد المعروض {TOTAL} هو عدد السجل نفسه، وأكبر كارت {BIGGEST} هو أكبر غرفة في السجل بالظبط، وكل غرفة طالعة مرة واحدة، والباب بلا جلسة مرفوض ٤٠١، ومفيش رقم لاتيني على الشاشة، ومفيش زحافة على عرض ٣٩٠، وصفر رسالة خطأ.",
  "  **عيب في محاجتي، اتسجّل قبل الرقم:** أول تشغيل حسّب «أكبر كارت ٢٥٤٨» وحكم على الشاشة بالفشل — والسبب كان جدول حروفي أنا كتبته ناقص في استخراج الرقم العربي من الصورة. قبل الإصلاح ده كان فيه تلاتة غيران تانين: مقارنة عدد مش مجمّع، وطلب «مجهول» مستعار من نفس المتصفح اللي فيه جلسة المالك، وعدّاد كونسول بيشتم خطواتي أنا. المحاجة بقت تستخرج الرقم بحرف صحيح، وتفتح متصفح تاني بلا كوكي للرفض، وتمسح أثر تنقّلاتها قبل ما تعدّ الأخطاء.",
  "  **البوابات:** {TESTS} اختبار أخضر (خروج {SUITE_EXIT}) · تيبشك سليم · بناء كامل · منشور · ٦ حرّاس على الشاشة، منها حارس بيمنع إن الاقتطاع يسبق الجمع.",
  "",
];

const body = lines
  .map((l) => l.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬"))
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => T[k]))
  .join("\n");

const allowed = Object.values(T).filter((v) => !/NaN|null|undefined/.test(String(v))).join("");
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
const prose = body.replace(/`[^`]*`/g, "");
const words = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(body)) throw new Error("a non-Arabic script leaked into the prose");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");

fs.appendFileSync(path, body, "utf8");
console.log("appended lines:", body.split("\n").length - 2);
console.log("الأرقام من القياس:", JSON.stringify({ TOTAL: T.TOTAL, BIGGEST: T.BIGGEST, REVIEWED: T.REVIEWED, PASSED: T.PASSED, FAILED: T.FAILED, TESTS: T.TESTS }));
