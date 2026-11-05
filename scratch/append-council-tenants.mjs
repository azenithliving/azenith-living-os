import fs from "node:fs";

/**
 * Appends the tenant-door atom. Numbers come from the probe's own output file.
 */
const path = "docs/ledger/council-minutes.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const prove = fs.readFileSync("scratch/ten-prove2.out", "utf8");
const suite = fs.readFileSync("scratch/ten-suite.out", "utf8").split(String.fromCharCode(27) + "[").map((c, i) => (i === 0 ? c : c.replace(/^[0-9;]*m/, ""))).join("");

const need = (label, re) => {
  const m = prove.match(re);
  if (!m) throw new Error("the probe never printed " + label);
  return m[1];
};
const ar = (v) => String(v).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const T = {
  WHEN: when,
  COMMIT: "f1a82dc",
  COMPANIES: ar(need("companies", /شركات في السجل: (\d+)/)),
  AFTER: ar(need("after", /الإجمالي رجع: (\d+)/)),
  GET_STATE: need("get status", /الباب رفض القراءة بالحالة: (\d+)/),
  POST_STATE: need("post status", /والكتابة بالحالة: (\d+)/),
  VERDICT: need("verdict", /الحكم: (.+)/).trim(),
  TESTS: ar((suite.match(/Tests\s+([\d,]+) passed/) ?? [])[1]),
  PROOF: "scratch/prove-tenants-door.mjs",
};

const lines = [
  "",
  "- **الوكيل ({WHEN}):** **باب الشركات كان عام بالكامل — أي زائر بيقرا اسم الدار ورقم واتسابها، وبيضيف شركة جديدة للسجل.**",
  "  **القياس على الرابط المنشور:** `{PROOF}` بلا كوكي وبلا جلسة: القراءة رجّعت الشركة الوحيدة باسمها ورقم واتسابها (الحالة ٢٠٠ و«الردّ فيه رقم واتساب؟» نعم — مطبوع في أول تشغيل للمحاجة دي قبل الإصلاح)، والكتابة عملت سطر شركة جديد — المحاجة مسحت سطر نفسها بس، والعدد رجع {COMPANIES}. الباب بيكتب بمفتاح الخدمة، والجدول ده نفسه هو اللي بيحدد الشركة اللي المستشار بيريّس عليها الزائر بالظبط، فالكتابة عنده معنى أكبر من مجرد سطر.",
  "  **القرار الأصعب قبل أي دمج — تصنيف الكيان:** `companies` **آلة مشتركة** مش موظف مبيعات: باب المستشار ومسار الطلبات بيقرّوا منها بالعنوان، ومفيش غير شركة واحدة في السجل ({COMPANIES}). فهي مش هتتدمج في مكتب المبيعات، واللوحة القديمة اللي بتعرضها هتتمسح مع اللوحة القديمة، وقرار مكانها الصح (مكتب النظام ولا ما لهوش شاشة دلوقتي) متسجّل مستني كلمة المالك.",
  "  **اللي اتصلح ({COMMIT}):** الفعلين استأذنوا بوابة الإدارة، والرسائل اتقالت بالعربي. **إعادة القياس بعد النشر:** القراءة {GET_STATE} والكتابة {POST_STATE}، وصفر اسم شركة اتسرب، وصفر سطر اتزاد. الحكم المطبوع من المحاجة: {VERDICT}.",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · حارسين بيمنعوا أي فعل من غير استئذان وأي رفض يوصل لاتيني.",
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
console.log("الأرقام من القياس:", JSON.stringify({ COMPANIES: T.COMPANIES, GET_STATE: T.GET_STATE, POST_STATE: T.POST_STATE, VERDICT: T.VERDICT, TESTS: T.TESTS }));
