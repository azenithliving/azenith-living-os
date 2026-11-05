/**
 * append-council-m1.mjs — the ledger line for M1 (the living ledger).
 * Every number here is parsed from a file a command printed this session.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const minutesPath = "docs/ledger/council-minutes.md";
const ESC = String.fromCharCode(27);
const plain = (s) => s.replace(new RegExp(ESC + "\\[[0-9;]*m", "g"), "");
const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const show = (ref) => execSync(`git show ${ref}`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const gate = plain(fs.readFileSync("scratch/m1-gate3.out", "utf8"));
const census = plain(fs.readFileSync("scratch/m1-census4.out", "utf8"));
const dead = plain(fs.readFileSync("scratch/m1-dead.out", "utf8"));
const unit = plain(fs.readFileSync("scratch/m1-unit2.out", "utf8"));
const proof = plain(fs.readFileSync("scratch/prove-m1-lands.out", "utf8"));
const buildLog = plain(fs.readFileSync("scratch/m1-buildlog.out", "utf8"));

function token(text, re, label) {
  const m = re.exec(text);
  if (!m) throw new Error("missing measurement: " + label);
  return m[1];
}

const before = JSON.parse(show("de1d5fa:docs/ledger/movements.json"));
const handRows = (before.rows ?? []).filter((r) => r.phase !== undefined);

const T = {
  TESTS: token(gate, /(\d+) اختبار ·/, "gate test total"),
  PASSED: token(gate, /· (\d+) أخضر ·/, "gate passed"),
  FAILED: token(gate, /· (\d+) أحمر ·/, "gate failed"),
  SKIPPED: token(gate, /· (\d+) متخطّى/, "gate skipped"),
  TYPECHECK: token(gate, /^typecheck=(\S+)/m, "typecheck"),
  BUILD: token(gate, /^build=(\S+)/m, "build"),
  LIVE: token(gate, /^live=(\S+)/m, "live"),
  VERDICT: token(gate, /^GATES: (\S+)/m, "verdict"),
  ATOMS: token(census, /census.json \((\d+) atoms\)/, "atoms"),
  ORPHAN_NEW: token(census, /"orphanDoors": (\d+)/, "orphan doors now"),
  ORPHAN_OLD: token(show("de1d5fa:docs/ledger/census.json"), /"orphanDoors": (\d+)/, "orphan doors before"),
  CRON_SCHEDULED: String(JSON.parse(show("de1d5fa:vercel.json")).crons.length),
  FURNITURE: token(dead, /· (\d+) unreachable furniture/, "unreachable furniture"),
  DEAD_LINE: token(dead, /^(٧.*باب يتيم.*)$/m, "dead line"),
  HAND_ROWS: String(handRows.length),
  HAND_SPELLINGS: String(new Set(handRows.map((r) => r.phase)).size),
  UNIT: token(unit, /Tests\s+(\d+) passed/, "unit tests"),
  UNIT_FILES: token(unit, /Test Files\s+(\d+) passed/, "unit files"),
  PROOF: token(proof, /^RESULT: (\d+) of/m, "proof passed"),
  PROOF_TOTAL: token(proof, /^RESULT: \d+ of (\d+)/m, "proof total"),
  DOOR_PHASES: token(proof, /"phases":(\d+)/, "door phase count"),
  SCREEN: token(proof, /screen text at 390px: (\d+) chars/, "screen chars"),
  SHOT: token(proof, /screenshot: (scratch\/[^\s]+)/, "screenshot"),
  ANON: token(proof, /status=(\d{3}) · \{"success":false/, "stranger status"),
  BUILD_ERROR: token(buildLog, /(Module not found: Can't resolve '[^']*')/, "host build error"),
  TOOLS: String(fs.readdirSync("scripts/instruments").filter((f) => f.endsWith(".mjs")).length),
};

for (const [k, v] of Object.entries(T)) {
  if (v === undefined || v === null || v === "") throw new Error("token has no value: " + k);
}
if (T.VERDICT !== "GREEN") throw new Error("the gate did not go green: " + T.VERDICT);
if (T.FAILED !== "0") throw new Error("the suite reported failures");
if (Number(T.PROOF) !== Number(T.PROOF_TOTAL)) throw new Error("the live proof failed a check");

const now = new Date();
const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (${AR(today)} ${AR(hh)}:${AR(mm)}):** **المرحلة واحد — الدفتر الحيّ: كل ذرة ليها مرحلة محسوبة من مكتبها، وخريطة للميت، والمِسطرة بقت شاشة.**`,
  `  **القياس الأول:** السجل فيه ${AR(T.ATOMS)} ذرة، و${AR(T.HAND_ROWS)} سطر بس كان حامل مرحلة مكتوبة باليد بـ${AR(T.HAND_SPELLINGS)} كتابة مختلفة، منها ما هو باسم مرحلة قديمة ومنها ما هو باسم شاشة — يعني الوكيل التاني كان ممكن يسمّي نفس الشغل باسم تاني · الأبواب اليتيمة كانت ${AR(T.ORPHAN_OLD)} و${AR(T.CRON_SCHEDULED)} منهم جدول يومي شغال كل يوم في ملف النشر، فالجرد كان بيسمّيهم موتى · والعفش اللي مالوش وصول ${AR(T.FURNITURE)} قطعة · والبوابة التالتة كانت بتبني المحرك القديم محليًا بينما السيرفر بيبني بمحرك تاني، فالأخضر المحلي ما كانش دليل على حاجة.`,
  `  **القرار:** المرحلة بقت بتتحسب من المكتب اللي الذرة مقعدة فيه (قائمة واحدة في طبقة عليها اختبارات)، فالسؤال «مين صاحب المرحلة» مالوش غير مالك، و${AR(T.HAND_ROWS)} سطر مكتوب باليد اتتنقل لحساب الآلة · وخريطة الميت بتدي أربع أحكام بس (يُصلَح / يتقاعد / قرار المالك / لسه ما اتصنفش) من قياس الملف نفسه: الأبواب اللي بيكتبها، والجداول اللي في ملفات تعريف المخزن، وهل فيه سطح حيّ بيجاوب نفس المورد · ومفيش حكم بيتخمن: اللي مفيش دليل عليه بيتسمّى «لسه ما اتصنفش» · وولا باب اتمسح. · المِسطرة بقت باب وشاشة في البيت الجديد، والباب والشاشة بيقروا من قارئ واحد، فالعدد اللي بيشوفه المالك والعدد اللي بيقوله الوكيل مالهمش مصدرين.`,
  `  **عيب حقيقي طلع من النشر نفسه:** أول محاولة اتنشرت رفضها السيرفر بـ\`${T.BUILD_ERROR}\` والبناء المحلي كان أخضر · السبب إن ملف الاستبعاد كان فيه سطر \`build\` من غير شرطة أول، والاسم المجرد بيطابق أي قطعة مسار في أي عمق، فمجلد طبقة البناء ما وصلش للسيرفر · اتصلّح بثلاث حاجات: سطر الاستبعاد بقى جذري، والمجلد اللي الباب بيقرأ منه استثنى صراحة، وبوابة البناء في أمر البوابات بقت تشغّل نفس محرك السيرفر · وحارس جديد يقرأ ملف الاستبعاد نفسه: المسارات اللي المِسطرة محتاجها توصل، واللي لازم ما توصلش (المسودة والمفاتيح والحزم) تفضل مستبعدة.`,
  `  **القياس الحيّ على الرابط المنشور:** \`scripts/instruments/prove-m1-lands.mjs\` — **نجحت ${AR(T.PROOF)} من ${AR(T.PROOF_TOTAL)}**: الباب ردّ بـ${AR(T.DOOR_PHASES)} مرحلة · والسطر من غير ولا رقم لاتيني · والغريب برا البوابة ردّ بـ${AR(T.ANON)} وما جاش منه ولا عدد · والشاشة عند عرض ٣٩٠ بكسل عرضت ${AR(T.SCREEN)} حرف من غير خطأ كونسول، وسمّت «ما اتقارش: القائمة الجامعة» لأن القائمة برا المستودع وما بتوصلش للنسخة المنشورة · والصورة (\`${T.SHOT}\`) اتبصّيت عليها.`,
  `  **وعيوب في مِقياسي اتصلّحت:** الأداة كانت بتطبع حالة الردّ من غير ما تناديها، فطلع نص دالة جوه السطر · وأول نسخة من خريطة الميت عدّت «باب يتيم» من غير ما تفرّق بين باب مالوش جدول وباب جدولها مش في المخزن، فبقى الحكم من ثلاث قياسات متفرقة · وأول تصنيف قال إن ولا باب ليه توأم وهو كان بيقارن آخر قطعة من المسار بس.`,
  `  **البوابات:** ${AR(T.TESTS)} اختبار (${AR(T.PASSED)} أخضر · ${AR(T.FAILED)} أحمر · ${AR(T.SKIPPED)} متخطّى) · منها ${AR(T.UNIT)} في ${AR(T.UNIT_FILES)} ملف لطبقة البناء والدفتر · تيبشك ${T.TYPECHECK === "PASS" ? "سليم" : "مرفوض"} · بناء ${T.BUILD === "PASS" ? "سليم بمحرك السيرفر" : "مرفوض"} · دليل حيّ ${T.LIVE === "PASS" ? "سليم" : "مرفوض"} · الحكم: أربع بوابات خضرا من أمر واحد · و${AR(T.TOOLS)} أداة في مجلد الأدوات المحفوظ.`,
  "",
];

const body = lines.join("\n");
const prose = body.replace(/`[^`]*`/g, "");
const strays = (prose.match(/[0-9]+/g) ?? []).filter((r) => !Object.values(T).map(String).join("").includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
const words = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !["mjs", "prove", "lands", "scratch", "instruments"].includes(w));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
if (body.includes("undefined") || body.includes("NaN")) throw new Error("a token had no measured value");

fs.appendFileSync(minutesPath, body, "utf8");
console.log("appended lines:", body.split("\n").length - 2);
console.log("المقاس:", JSON.stringify(T), "today=" + today);
