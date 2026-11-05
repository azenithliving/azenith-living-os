import fs from "node:fs";

/**
 * Appends the learning-mode security atom. Numbers come from the probe's own output file.
 */
const path = "docs/ledger/council-minutes.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const prove = fs.readFileSync("scratch/sec-prove.out", "utf8");

const need = (label, re) => {
  const m = prove.match(re);
  if (!m) throw new Error("the probe never printed " + label);
  return m[1];
};
const ar = (v) => String(v).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
const suite = fs.readFileSync("scratch/sec-suite.out", "utf8");

const T = {
  WHEN: when,
  COMMIT: "aa680ea",
  BEFORE: ar(need("before", /سطور القواعد قبل القياس: (\d+)/)),
  AFTER: ar(need("after", /سطور القواعد بعد القياس: (\d+)/)),
  VERDICT: need("verdict", /الحكم: (.+)/).trim(),
  TESTS: ar((suite.match(/Tests\s+([\d,]+) passed/) ?? [])[1]),
  PROOF: "scratch/prove-learning-mode-hole.mjs",
};

const lines = [
  "",
  "- **الوكيل ({WHEN}):** **وضع التعليم كان بوابة مفتوحة: زائر بلا دخول كان يقدر يعلّم مدير المبيعات — وقفلته بقياس على الرابط المنشور.**",
  "  **الثغرة كانت شغّالة مش نظرية:** باب المستشار العام بيقرر «وضع التعليم الإداري» من حقل بريد إلكتروني جوه متن الطلب نفسه، وبيكتب بمفتاح الخدمة. محاجة على الرابط المنشور (`{PROOF}`) بعتت طلب واحد بحقل البريد: السجل زاد سطراً مزروعاً والباب ردّ بالإنجليزي `Knowledge saved successfully` — والعدد قبلها وبعدها مطبوع في رسالة الحفظ ({COMMIT})، والسطر المزروع اتمسح بمعرّفه في نفس القياس.",
  "  **اللي اتصلح ({COMMIT}):** القرار بقى يسأل جلسة الإدارة الحقيقية (نفس الحارس اللي على باقي أبواب اللوحة)، مش اسماً مكتوب في الطلب. الردّ بقى بالعربي. والبريد في المتن فضل مكانه في سجل العميل بس ما بقاش يفتح صلاحية.",
  "  **إعادة القياس بعد النشر — الباب مقفول:** نفس الطلب بالحرف رجع بردّ عميل عادي، والسجل {BEFORE} سطراً قبل و{AFTER} بعد، والمحاجة ما لقتش السطر المزروع. الحكم المطبوع من المحاجة: {VERDICT}.",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · {PROOF} — و٣ حرّاس في ملف أمان جديد بيمنعوا أي نداء لوضع التعليم يمرر بريد المتن.",
  "",
];

const body = lines
  .map((l) => l.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬"))
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => T[k]))
  .join("\n");

const allowed = Object.values(T).join("");
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
const prose = body.replace(/`[^`]*`/g, "");
const words = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(body)) throw new Error("a non-Arabic script leaked into the prose");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");

fs.appendFileSync(path, body, "utf8");
console.log("appended lines:", body.split("\n").length - 2);
console.log("الأرقام من القياس:", JSON.stringify({ BEFORE: T.BEFORE, AFTER: T.AFTER, VERDICT: T.VERDICT, TESTS: T.TESTS }));
