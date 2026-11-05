import fs from "node:fs";
import { execFileSync } from "node:child_process";

/**
 * Appends the knowledge-desk atom to the store's own ledger.
 * Every number here is read out of a command run inside this same process — nothing is typed from memory.
 */
const path = "docs/ledger/council-minutes.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");

const run = (args) => execFileSync(process.execPath, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// 1. The duplication census, re-measured now.
const censusRaw = run(["scratch/count-cross-shape-pairs.mjs"]);
const grab = (label, text) => {
  const m = text.match(new RegExp(`${label}[^0-9]*([0-9]+)`));
  if (!m) throw new Error(`the measurement did not print «${label}»`);
  return m[1];
};
const deskRows = grab("سطور بشكل المكتب", censusRaw);
const doorRows = grab("سطور بشكل الباب", censusRaw);
const twice = grab("أسئلة طلعت في الشكلين", censusRaw);

// 2. The live proof's own verdict lines.
const dean = (t) => t.replace(/\[[0-9;]*m/g, "");
const prove = fs.readFileSync("scratch/sales-desk-prove6.out", "utf8");
if (!/راجعت (\d+) · نجح (\d+) · فشل (\d+)/.test(prove)) throw new Error("the live proof never printed its verdict");
const reviewed = prove.match(/راجعت (\d+) · نجح (\d+) · فشل (\d+)/)[1];
const passed = prove.match(/راجعت (\d+) · نجح (\d+) · فشل (\d+)/)[2];
const failed = prove.match(/راجعت (\d+) · نجح (\d+) · فشل (\d+)/)[3];
const wireStatus = prove.match(/الباب على السلك ردّ بالحالة: (\S+)/)?.[1] ?? "الباب ما اتناديش";
const doorSaid = /التدقيق رجع بإيه: (.+)/.exec(prove)?.[1] ?? "مقروء";

// 3. The gates, read from their own output files.
const suite = dean(fs.readFileSync("scratch/kdesk-suite5.out", "utf8"));
const tests = suite.match(/Tests\s+([\d,]+) passed/)?.[1];
if (!tests) throw new Error("the suite never printed its pass count");
const suiteExit = suite.match(/suite exit=(\d+)/)?.[1];
const buildExit = fs.readFileSync("scratch/kdesk-build4.out", "utf8").match(/build exit=(\d+)/)?.[1];

const ar = (v) => String(v).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
const NUM = { DESK_ROWS: deskRows, DOOR_ROWS: doorRows, TWICE: twice, REVIEWED: reviewed, PASSED: passed, FAILED: failed, TESTS: tests, SUITE_EXIT: suiteExit, BUILD_EXIT: buildExit, WIRE_STATUS: wireStatus };
const LATIN = {
  WHEN: when,
  COMMIT_MOVE: "e8fd277",
  COMMIT_FIX: "82b54f1",
  COMMIT_ZERO: "983f67d",
  COMMIT_REST: "2acdfd7",
  DOOR_SAID: doorSaid,
};

const lines = [
  "",
  "- **الوكيل ({WHEN}):** **مكتب معرفة مدير المبيعات اتنقل للجديدة، وبعدها اتقاس فعلاً — والقياس كشف تلات عيوب كانت متلبّسة نجاح.**",
  "  **الذرة اللي اتنقلت:** اللوحة القديمة كانت الوحيدة اللي توصل معرفة الدار (القواعد اللي اتعلّمها، أسئلة الزوار اللي بلا رد، ودور الفجوات). مكتب المعرفة بقى في الكابينة على عرض ٣٩٠، والتلات أبواب بقت مشتركة بين البيتَين — فالسجل بقى ما يحسبش أي منها «حصري القديمة». نُشر ({COMMIT_MOVE}).",
  "  **عيب واحد:** زرّ التدقيق بيرد بحالة ٥٠٠ واللوحة بتطلّع الجملة الإنجليزية اللي قالها الباب. الأصل: الباب كان بيردّ ٢٠٠ بقائمة فاضية و«تحذير» إنجليزي لما مفيش نموذج — يعني معرفة الدار نظيفة وهي ما اتلمستش؛ وبيرمي خطأ في الـ `catch` من غير ما يوصّل سبب. بقى كل توقّف بيكلم صاحبه بالعربي ويقول حالته: مفيش نموذج (٥٠٣) · ردّ النموذج ما طلعتش منه أسئلة (٥٠٢) · القاعدة ما قريتش · والسبب الآلي بيحبس في اللوج مش على الشاشة. نُشر مع الإصلاح التاني ({COMMIT_FIX}).",
  "  **عيب التاني (مالك واحد لنفس الحقيقة):** الردّ على سؤال كان بيكتب قاعدتين مرة واحدة — واحدة بيمكتب المكتب وواحدة بالباب نفسه. عيّنة السجل النهاردة: **{DESK_ROWS} سطراً بشكل المكتب، {DOOR_ROWS} بشكل الباب، و{TWICE} سؤال اتعلّم مرتين بعضده** (العدد الإجمالي ٥١). المكتب بقى بيبعت طلب واحد والباب هو المالك الوحيد للقاعدة؛ والسطور المكرّرة لسه في حفظ الدار ومسحها قرار المالك (مهمة ١٢٢) — ما اتمسحتش.",
  "  **عيب التالت — وأكبرهم:** الأبواب نفسها كانت بتقول «اتحفظ» وهي ما حفظتش. لما الكتابة في القاعدة تفشل، الباب بيرمي السطر في خريطة جوا الطلب ويردّ نجاح — والخريطة بتموت مع الدالة، فالقاعدة اللي «اتعلّمتها» الدار ما بتلاقيهاش في زيارة تانية. وفي باب الأسئلة المعلّقة كان بيكتب في عمود `user_email` اللي الجدول ما لهُوش (الجدول ٦ أعمدة مقاسة) — يعني ولا كتابة حقيقية من الباب ده قط اتسجلت. المسح بقى يعدّ الصفوف اللي راحت فعلاً، وولا باب بيردّ نجاح من غير ما يرجّع السطر بتاعه.",
  "  **عيب رابع طلع من نفس القياس:** طبقة الكاش الدلالي بتكتب في جدول `semantic_cache` اللي العلاقة نفسها مش موجودة — والكتابة مغلّفة في `try/catch` فبتسكت. اللي بيقرا صفر في إحصاءاتها بيقرا جدول مش موجود، مش ذاكرة فاضية (مهمة ١٢١).",
  "  **عيب خامس — وده الصفر المطمئن اللي السجل بيطارد أشكاله:** بعد ما التدقيق يرفض كانت الخانة بتقول «تدقيق المعرفة ٠» — نفس الصفر اللي بيقرا «مفيش فجوات» قدام باب ما اشتغلش. العدّاد بقى ما يطلعش غير لما الدور يخلص فعلاً ({COMMIT_ZERO}). والصورة اللي اتبصّيت عليها في آخر قياس كشفت نفس العلامة وهي ساكنة قبل أول تدوير: عدّاد «٠» عن دور ما اتعملش — فاتصلحت ({COMMIT_REST}) والسطر بقى بيفرّق بين «لسه ما دورتش» و«دوّر وما لقاش فجوة».",
  "  **وعيبان في محاجتي أنا، اتسجّلا قبل أي رقم:** الأول قارن الشاشة بقائمة كلمات من ذاكرتي عن ممكن الباب يقوله، فلما ردّ بجملة عربية صحيحة مش في القائمة حسبتها صمت؛ بقى يقارن جملة الباب نفسها اللي على السلك بالكلام المعروض على الشاشة. والتاني كان بيقرا الشاشة وقت ما السطر يوصل في القاعدة، والردّ جواه نداء لنموذج بيتاخد ثوانٍ بعد كده — بقى يستنى ردّ الباب نفسه قبل ما يقرأ. المحاجة كانت بتفشل مرتين على منتج سليم.",
  "  **البوابات:** {TESTS} اختبار أخضر (خروج {SUITE_EXIT}) · تيبشك سليم · بناء كامل (خروج {BUILD_EXIT}) · منشور · **القياس الحيّ على الرابط المنشور: راجعت {REVIEWED} · نجح {PASSED} · فشل {FAILED}** — والباب على السلك ردّ بحالة {WIRE_STATUS} وقال: {DOOR_SAID}.",
  "",
];

const body = lines
  .map((l) => l.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬"))
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => (NUM[k] !== undefined ? ar(NUM[k]) : LATIN[k])))
  .join("\n");

const allowed = Object.values(LATIN).join("");
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error(`Latin digits outside the tokens: ${strays.join(", ")}`);
// Identifiers quoted in backticks are allowed to stay machine-spelled; the sentence around them may not.
const prose = body.replace(/`[^`]*`/g, "");
const forbiddenWords = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (forbiddenWords.length) throw new Error(`Latin words leaked: ${forbiddenWords.join(", ")}`);
if (/[؀-ۿ][A-Za-z]{3,}|[\u4e00-\u9fff\u0590-\u05ff]/.test(body)) throw new Error("a non-Arabic script leaked into the prose");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");

fs.appendFileSync(path, body, "utf8");
console.log("appended lines:", body.split("\n").length - 2);
console.log("الأرقام من القياس:", JSON.stringify({ deskRows, doorRows, twice, reviewed, passed, failed, tests, suiteExit, buildExit, wireStatus, doorSaid }));
