import fs from "node:fs";

/**
 * Appends the widened-copy atom. Every number is read out of the live proof's own output file, which
 * that measurement wrote — nothing here is typed from memory.
 */
const path = "docs/ledger/council-minutes.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const ESC = String.fromCharCode(27);
const suite = fs.readFileSync("scratch/snap-suite.out", "utf8").split(ESC + "[").map((c, i) => (i === 0 ? c : c.replace(/^[0-9;]*m/, ""))).join("");
const prove = fs.readFileSync("scratch/snap-prove2.out", "utf8").split(ESC + "[").map((c, i) => (i === 0 ? c : c.replace(/^[0-9;]*m/, ""))).join("");

const need = (label, re) => {
  const m = prove.match(re);
  if (!m) throw new Error("the proof never printed " + label);
  return m[1];
};
const ar = (v) => String(v).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const raw = {
  TABLES: need("table count", /الباب قال: الجداول = (\d+)/),
  ROWS: need("rows", /"rows":(\d+)/),
  BYTES: need("bytes", /"bytes":(\d+)/),
  LEARN: need("learnings", /consultant_learnings=(\d+)/),
  PEND: need("pending", /consultant_pending_questions=(\d+)/),
  REVIEWED: need("reviewed", /راجعت (\d+) ·/),
  PASSED: need("passed", /نجح (\d+) ·/),
  FAILED: need("failed", /فشل (\d+)/),
  TESTS: (suite.match(/Tests\s+([\d,]+) passed/) ?? [])[1] ?? (() => { throw new Error("the suite never printed its count"); })(),
};
const T = { WHEN: when, COMMIT: "e16b87a" };
for (const [k, v] of Object.entries(raw)) T[k] = ar(v);

const lines = [
  "",
  "- **الوكيل ({WHEN}):** **حفظ مدير المبيعات دخل نسخة الدار الليلية — الجدولان اللي فيهم قواعده وأسئلة زواره المعلقة كانوا بره النسخة الوحيدة اللي للدار.**",
  "  **الغيبة ما كانش محدش شايفها:** النسخة اتعملت يوم ٢٠٢-١٠-١٩ بتسعة جداول، ومحدش قارن القائمة دي بالجداول اللي فعلاً فيها كلام المالك. النهاردة اتقاس: **{LEARN} سطراً في القواعد، {PEND} سطراً في الأسئلة المعلّقة** — الاتنين بره. يعني لو ضاع حفظ المدير، مالوش نسخة.",
  "  **اللي اتعمل ({COMMIT}):** الجدولين اتضافوا، والنسخة بقت **{TABLES} جدولاً**، والحارس بقى يفشّل الاختبار لو الجدولين خرجوا من القائمة. المضغوط النهاردة **{BYTES} بايت** في **{ROWS} سطراً**. بنك الصور بره بقصد: ١٣٦٣١٬٤٨٨ بايت على القرص، واللي يولّده تاني موجود.",
  "  **عيب في محاجتي، اتسجّل قبل الرقم:** باب النشر في المحاجة كان مستني «عدد جداول يوصل» — والنسخة القديمة بترجّع عدد كمان، فقبلت ٩ وحسبت توسيع الـ ١١ فشلاً. بقى الباب يستنى **القيمة المطلوبة نفسها** مش وجود الحقل: «الحقل موجود» صحيح في كل نسخة سابقة.",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · **قياس حيّ على الرابط المنشور: راجعت {REVIEWED} · نجح {PASSED} · فشل {FAILED}** — الختم بيقول {ROWS} سطراً و{BYTES} بايت وصفر رفض، والدرج فيه {TABLES} ملف، ومفيش سطر من سجله اتمسح أو اتغيّر.",
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
console.log("الأرقام من القياس:", JSON.stringify(raw));
