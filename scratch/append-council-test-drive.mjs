import fs from "node:fs";

/**
 * Appends the test-drive atom and the learning-mode correction. Every number is read out of the two
 * probes' own output files, written by the same measurements.
 */
const path = "docs/ledger/council-minutes.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const ESC = String.fromCharCode(27);
const dean = (t) => t.split(ESC + "[").map((c, i) => (i === 0 ? c : c.replace(/^[0-9;]*m/, ""))).join("");

const drive = fs.readFileSync("scratch/td-prove2.out", "utf8");
const hole = fs.readFileSync("scratch/sec-prove2.out", "utf8");
const firstDrive = fs.readFileSync("scratch/td-prove.out", "utf8");
const suite = dean(fs.readFileSync("scratch/td4-suite.out", "utf8"));

const need = (text, label, re) => {
  const m = text.match(re);
  if (!m) throw new Error("the measurement never printed " + label);
  return m[1];
};
const ar = (v) => String(v).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const T = {
  WHEN: when,
  COMMIT_BUILD: "e16e9f2",
  COMMIT_SEC: "5de954a",
  RULES_BEFORE: ar(need(hole, "rules before", /سطور القواعد قبل القياس: (\d+)/)),
  RULES_AFTER: ar(need(hole, "rules after", /سطور القواعد بعد القياس: (\d+)/)),
  FIRST_REPLY: need(firstDrive, "first reply", /الردّ المعروض هو ردّ الباب نفسه · (.+)/).trim(),
  DRIVE_REVIEWED: ar(need(drive, "reviewed", /راجعت (\d+) ·/)),
  DRIVE_PASSED: ar(need(drive, "passed", /نجح (\d+) ·/)),
  DRIVE_FAILED: ar(need(drive, "failed", /فشل (\d+)/)),
  HOLE_VERDICT: need(hole, "verdict", /الحكم: (.+)/).trim(),
  TESTS: ar((suite.match(/Tests\s+([\d,]+) passed/) ?? [])[1]),
  DOOR_HOLE: "scratch/prove-learning-mode-hole.mjs",
  DOOR_DRIVE: "scratch/prove-advisor-test-drive.mjs",
};

const lines = [
  "",
  "- **الوكيل ({WHEN}):** **تجربة المستشار اتبنيت على مكتب المدير، والتصحيح الأول لثغرة التعليم اتراجع — لأن قفلها بالجلسة نقلها لجيب المالك.**",
  "  **اللي اتكشف في الباب القديم:** اللوحة القديمة ما كانش فيها تجربة أصلًا — حالة محادثة ودالة إرسال من غير مربّع كتابة ومن غير عرض رسائل، فالقدرة ما كانتش على أي شاشة. وكمان الدالة كانت بتقرأ خانة `response` اللي الباب ما بيبعتهاش (الاسم الحقيقي `reply`) وبتبعت علم إدارة ما بيقرأهش حد.",
  "  **اللي اتعمل ({COMMIT_BUILD}):** تجربة المستشار بقت على مكتب المدير في الجديدة: سؤال عميل، والردّ المعروض هو ردّ الباب نفسه، ولو الباب ما ردّش أو رجّع فاضي الشاشة بتقول كده. ومعرف الجلسة بتبدأ بـ«تجربة-المالك-» عشان تتفرّق، والسطر تحتها بيصدق إن السؤال بيتسجّل في دفتر العملاء.",
  "  **والتصحيح اللي فشل ({COMMIT_SEC}):** بعد قفل الثغرة بالجلسة، أول قياس حيّ طلع بردّ الباب على شاشة المالك: «{FIRST_REPLY}» — يعني كل سؤال بيجرّبه كان بيتحوّل لقاعدة في حفظ المدير، والسجل عدّى من {RULES_BEFORE} لزيادتها. وضع التعليم اتشال من الباب العام كله: ما كانش له شاشة، وقائمة جلسات الإدارة كانت فاضية في الكود، والتدريس له مالك واحد هو مكتب المعرفة اللي بيسأل بوابة الإدارة قبل الكتابة. أثر القياس اتمسح والعدد رجع {RULES_AFTER}.",
  "  **القياس الحيّ على الرابط المنشور بعد التصحيحين:** `{DOOR_HOLE}` — طلب مجهول بالحرف اللي زرع قاعدة الأول: رجع بردّ عميل عادي، والسجل {RULES_BEFORE} قبل و{RULES_AFTER} بعد، وصفر سطر مزروع. الحكم المطبوع: {HOLE_VERDICT}. و`{DOOR_DRIVE}` — **راجعت {DRIVE_REVIEWED} · نجح {DRIVE_PASSED} · فشل {DRIVE_FAILED}**: الردّ المعروض هو ردّ الباب، سؤال التجربة ما اتسجّلش قاعدة، الباب فعلاً كتب محادثة في الدفتر (فالشاشة ما بتكذبش في سطر التحذير)، مربّع الكتابة جوه عرض ٣٩٠، مفيش زحافة أفقية، صفر رسالة خطأ، وأثر القياس اتمسح بمعرّفه.",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · و٣ حرّاس أمان: الباب العام ما بيعملش إدراج في جدول القواعد، ومفيش هوية بتتقرا من المتن، وكل فعل كتابة في باب المكتب يستأذن البوابة.",
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
console.log("الأرقام من القياس:", JSON.stringify({ RULES_BEFORE: T.RULES_BEFORE, RULES_AFTER: T.RULES_AFTER, FIRST_REPLY: T.FIRST_REPLY, DRIVE_REVIEWED: T.DRIVE_REVIEWED, DRIVE_PASSED: T.DRIVE_PASSED, DRIVE_FAILED: T.DRIVE_FAILED, TESTS: T.TESTS }));
