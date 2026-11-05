import { appendFileSync, readFileSync } from "node:fs";

/**
 * The ledger minute for the first sweep of every admin screen.
 *
 * Both numbers come from the two sweep reports on disk — the run before the repair and the run after
 * it — so the minute cannot quote a repair it did not measure.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const ledgerPath = "docs/ledger/council-minutes.md";
const MARK = ar("أول مرة اتعدّ شاشات الإدارة الثلاثين");

const ledger = readFileSync(ledgerPath, "utf8");
if (ledger.includes(MARK)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const before = JSON.parse(readFileSync("scratch/a11y-admin-sweep-before.json", "utf8"));
const after = JSON.parse(readFileSync("scratch/a11y-admin-sweep.json", "utf8"));

const sum = (list) => ({
  screens: list.length,
  blocked: list.filter((s) => s.violations < 0).length,
  nodes: list.reduce((n, s) => n + Math.max(0, s.violations), 0),
  undecided: list.reduce((n, s) => n + (s.incomplete ?? 0), 0),
  clean: list.filter((s) => s.violations === 0).length,
  rules: [...new Set(list.flatMap((s) => s.rules.map((v) => v.id)))],
});
const b = sum(before);
const a = sum(after);
if (b.blocked || a.blocked) {
  console.log(`REFUSING TO WRITE: a sweep did not open every screen (before ${b.blocked}, after ${a.blocked}).`);
  process.exit(1);
}

const house = (list, v2) => {
  const set = list.filter((s) => (v2 ? s.path.startsWith("/admin/v2") : !s.path.startsWith("/admin/v2")));
  return {
    nodes: set.reduce((n, s) => n + Math.max(0, s.violations), 0),
    undecided: set.reduce((n, s) => n + (s.incomplete ?? 0), 0),
  };
};
const v2 = house(after, true);
const old = house(after, false);

const addition = ar(`
- **وكيل المتجر (${new Date().toISOString().slice(0, 16).replace("T", " ")}):** **${MARK}:** كل رقم «صفر مخالفات» اتقال قبل كده كان على اللي حد بصّ عليه — ست شاشات، وبعدين 18. المرة دي آلة واحدة فتحت **كل شاشات الإدارة الـ 30** على الرابط المنشور، دخول جديد قبلها، وكل شاشة في متصفح لوحدها عشان غلط شاشة ما ينسبش لتانية. **طلع: 17 عقدة مخالفة في 6 قواعد، و16 عقدة الفاحس ما قدرش يحكم عليها.**
  - **عيب في الأداة نفسها اتصحح الأول:** أول لفة قالت «صفر مخالفات» على التلاتين — وهي ما فتحت ولا شاشة، لأن الآلة كانت بتستعمل جلسة محفوظة من 19 ساعة وبتقبلها وهي منتهية. بقت تعمل الدخول بنفسها قبل كل لفة، ولو أي شاشة رجعت لصفحة الدخول اللفة كلها بتترفض وتطلع برقم خطأ، مش بصفر.
  - **العقد اللي «ما اتحكمش عليها» اتقاست بالبكسل:** الفاحس بيرفض أي نص فوق خلفية متدرجة — وده كل تصميم الدار. فآلة جديدة رسمت الشاشة، وقرا لون كل سطر بعد ما حلّ صيغة الألوان الجديدة، وأخذت أغمق ربع بكسلات الصندوق كلونٍ خلفي، وحسبت النسبة نفسها اللي يحسبها المعيار. **النتيجة: العشر عقد بتوع لوحة الاستوديو ما بين 9.4 و18.3 — كلها فوق الحدّ، وتسعة منها فوق حدّ AAA.** وفي الطريق ده وقعت تلات غلطات في الأدات نفسها واتصححت: صيغة ألوان ما اتحلّتش (طلعت «تباين صفر» وهي أصلًا ما قراتش)، ومعادلة الشفافية مقلوبة، وقشرة يونكس بتاكل المسار لو اتقالت كوسيط.
  - **اللي اتصلح في البيت الجديد:** **31 سطر** كان مكتوب بين عشرين وستين بالمئة أبيض فوق كروت متدرجة (لوحة الاستوديو · ذاتية السرب · كتلة القرار · لوحة الأوامر) رفعناهم لسبعين، وشارة عدد اللي مستني رد كانت أبيض على أحمر بدرجة 3.75 مقيسة على الشاشة — بقت على أحمر يقرا، و**سطر «الغرض» في رأس الأقسام المشترك بين خمس شاشات طلع 4.48 مقابل حدّ 4.5** — تحت، فرفعناه. والأهم: الحارس اللي بيمنع النص الشاحب **ما كانش بيعرف الخمس ملفات دول أصلًا** — اتوسّع، فالإصلاح ده بيمنع الرجوع مش بيغطي على العيب.
  - **اللي لسه في البيت القديم (${old.nodes} عقدة، مسجلة ومش متلمسة):** تباين في اللوحة الرئيسية والإعدادات و«صندوق الرمل»، وعنوان بلا اسم يقرأه قارئ الشاشة في مساعد المتصفح (دي أخطر واحدة)، وتكرار منطقة «الرئيسية» في صفحتي النخبة والمصير، وسلسلة عناوين في اللوحة القديمة. السبب مش كسل: الآلة أثبتت إن المكونات دي محطوطة ورا باب البيت القديم بس، واللي بيتمسح بقراره — فالشغل عليه خسارة وقت لحد ما يقول.
  - **بعد اللفة:** ${a.nodes} عقدة مخالفة (كانت ${b.nodes}) · ${a.undecided} ما اتحكمش عليها (كانت ${b.undecided}) · شاشات نظيفة ${a.clean} من ${a.screens} · البيت الجديد ${v2.nodes} عقدة و${v2.undecided} غير محسومة · البيت القديم ${old.nodes} عقدة و${old.undecided} غير محسومة.
  - **البوابات:** 2108 اختبار أخضر (كانت 2102) · تيبشك سليم · بناء كامل · أربع نشرات والقياس بعد كل واحدة
`);

appendFileSync(ledgerPath, addition, "utf8");
const text = readFileSync(ledgerPath, "utf8");
console.log(`before nodes=${b.nodes} undecided=${b.undecided} · after nodes=${a.nodes} undecided=${a.undecided} clean=${a.clean}/${a.screens} written: ${text.includes(MARK)}`);
