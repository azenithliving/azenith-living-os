/**
 * append-council-m0.mjs — the ledger line for M0 (the ruler and the gate machine).
 * Every number is parsed from a file a command printed this session.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const counted = (command) =>
  execSync(command, { encoding: "utf8" }).split(/\r?\n/).filter((line) => line.trim()).length;

const minutesPath = "docs/ledger/council-minutes.md";
const ESC = String.fromCharCode(27);
const plain = (s) => s.replace(new RegExp(ESC + "\\[[0-9;]*m", "g"), "");
const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));

const gate = plain(fs.readFileSync("scratch/m0-gate.out", "utf8"));
const ruler = plain(fs.readFileSync("scratch/m0-ruler2.out", "utf8"));
const manifest = plain(fs.readFileSync("scratch/m0-manifest2.out", "utf8"));
const proof = plain(fs.readFileSync("scratch/prove-ruler-lands.out", "utf8"));
const unit = plain(fs.readFileSync("scratch/m0-green3.out", "utf8"));

function token(text, re, label) {
  const m = re.exec(text);
  if (!m) throw new Error("missing measurement: " + label);
  return m[1];
}

const T = {
  TESTS: token(gate, /(\d+) اختبار ·/, "gate test total"),
  PASSED: token(gate, /· (\d+) أخضر ·/, "gate passed"),
  FAILED: token(gate, /· (\d+) أحمر ·/, "gate failed"),
  SKIPPED: token(gate, /· (\d+) متخطّى/, "gate skipped"),
  TYPECHECK: token(gate, /^typecheck=(\S+)/m, "typecheck"),
  BUILD: token(gate, /^build=(\S+)/m, "build"),
  LIVE: token(gate, /^live=(\S+)/m, "live gate"),
  VERDICT: token(gate, /^GATES: (\S+)/m, "gate verdict"),
  PHASE: token(ruler, /المرحلة ([٠-٩]+) من/, "phase number"),
  PHASE_TOTAL: token(ruler, /المرحلة [٠-٩]+ من ([٠-٩]+)/, "phase total"),
  ITEMS_PROVEN: token(ruler, /البند ([٠-٩]+) من/, "items proven"),
  ITEMS_TOTAL: token(ruler, /البند [0-9٠-٩]+ من ([٠-٩]+)/, "items total"),
  ATOMS_MOVED: token(ruler, /الذرة ([٠-٩]+) من/, "atoms moved"),
  ATOMS_TOTAL: token(ruler, /الذرة [0-9٠-٩]+ من ([٠-٩]+)/, "atoms total"),
  CENSUS_DATE: token(ruler, /الجرد من ([٠-٩-]+)/, "census date"),
  FILES: token(manifest, /scratch manifest: (\d+) files/, "scratch files"),
  TOOLS: token(manifest, /· (\d+) instruments/, "scratch instruments"),
  BYTES: token(manifest, /· (\d+) bytes/, "scratch bytes"),
  UNIT: token(unit, /Tests\s+(\d+) passed/, "unit tests"),
  UNIT_FILES: token(unit, /Test Files\s+(\d+) passed/, "unit files"),
  PROOF: token(proof, /^RESULT: (\d+) of/m, "proof passed"),
  PROOF_TOTAL: token(proof, /^RESULT: \d+ of (\d+)/m, "proof total"),
  COCKPIT: token(proof, /cockpit text at 390px: (\d+) chars/, "cockpit chars"),
  SCREENSHOT: token(proof, /screenshot: (scratch\/[^\s]+)/, "screenshot"),
  COMMITTED_TOOLS: fs.readdirSync("scripts/instruments").filter((f) => f.endsWith(".mjs")).length,
  TRACKED_IN_REPO: counted("git ls-files scratch"),
};

for (const [k, v] of Object.entries(T)) {
  if (v === undefined || v === null || v === "") throw new Error("token has no value: " + k);
}
if (T.VERDICT !== "GREEN") throw new Error("the gate command did not go green: " + T.VERDICT);
if (T.TYPECHECK !== "PASS" || T.BUILD !== "PASS" || T.LIVE !== "PASS") throw new Error("a gate refused");
if (T.FAILED !== "0") throw new Error("the suite reported failures");
if (Number(T.PROOF) !== Number(T.PROOF_TOTAL)) throw new Error("the live proof failed a check");
if (Number(T.COMMITTED_TOOLS) < 4) throw new Error("the instruments were not promoted: " + T.COMMITTED_TOOLS);

const now = new Date();
const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (${AR(today)} ${AR(hh)}:${AR(mm)}):** **المرحلة صفر — المِسطرة بقت أمر واحد: البوابات الأربع والعدد التلاتة بسطر، واللي ما اتقارش يتسمّى.**`,
  `  **القياس الأول:** أدوات البرهان كانت ${AR(T.TOOLS)} أداة في مجلد واحد الاستعمال، ${AR(T.FILES)} ملف و${AR(T.BYTES)} بايت، ${AR(T.TRACKED)} ملف بس منهم محفوظ في المستودع والباقي مش محفوظ — يعني الأدلة نفسها كانت أقرب حاجة تتضيع · والبوابات الأربع كانت عرف مكتوب: تلاتة ليهم أمر والرابع (القياس الحيّ على عرض الموبايل) كان سكربتات بتتكتب كل مرة من الصفر.`,
  `  **القرار:** منطق المِسطرة والبوابات اتعمل في طبقة عليها اختبارات (${AR(T.UNIT)} اختبار في ${AR(T.UNIT_FILES)} ملف)، والسكربت بقى قشرة تشغيل بس — وحارس يمنع إن المنطق يرجع يتكتب جوه السكربت أو إن نسخة من أداة ترجع في المجلد القديم · ${AR(T.COMMITTED_TOOLS)} أدوات اتنقلت/اتعملت في مجلد الأدوات المحفوظ · وأمر واحد بقى يمشّي الاختبارات وتيبشك والبناء الكامل والدليل الحيّ، ويطلع برقم غير صفر لو بوابة رفضت **أو ما اتشغّلتش** (اللي ما اتشغّلتش مش نجاح) · وسجل جديد يسمّي كل ملف لسه في المجلد القديم (عدد · أدوات · بايتات) عشان «مفيش حاجة اتنسيت» يبقى له ملف.`,
  `  **عيب حقيقي طلع من المِسطرة نفسها:** الذرات والأبواب بيتحسبوا من جرد تاريخه ${T.CENSUS_DATE}، وكان ممكن يتقالوا كأنهم قياس النهاردة ·بقى السطر يحمل تاريخ الجرد نفسه لما يكون غير النهاردة. وعيب في مِقياسي: أول محاولة شغّلت الأداة بمشغّل سكربتات تايب‌سكربت فشلّت لأن اسم المسار المختصر ما اتحلّش، فاتنقل المنطق للطبقة المُختبَرة والسكربت بقى تشغيل بس.`,
  `  **القياس الحيّ على الرابط المنشور:** \`scripts/instruments/prove-ruler-lands.mjs\` — **نجحت ${AR(T.PROOF)} من ${AR(T.PROOF_TOTAL)}**: المِسطرة ردّت «المرحلة ${T.PHASE} من ${T.PHASE_TOTAL} · البند ${T.ITEMS_PROVEN} من ${T.ITEMS_TOTAL} مُثبت بدليل · الذرة ${T.ATOMS_MOVED} من ${T.ATOMS_TOTAL} اتنقلت · الجرد من ${T.CENSUS_DATE}» ومن غير ولا رقم لاتيني · ولما المصادر اتقطعت عمدًا، السطر قال «ما اتقارش» وسمّى القائمة الجامعة وسجل النقل والجرد والاختبارات والدليل الحيّ، وما طلعش صفر مطمئن · والكابينة على الرابط المنشور عرضت ${AR(T.COCKPIT)} حرف عند عرض ٣٩٠ بكسل من غير خطأ كونسول، والصورة (\`${T.SCREENSHOT}\`) اتبصّيت عليها.`,
  `  **البوابات:** ${AR(T.TESTS)} اختبار (${AR(T.PASSED)} أخضر · ${AR(T.FAILED)} أحمر · ${AR(T.SKIPPED)} متخطّى) · تيبشك ${T.TYPECHECK === "PASS" ? "سليم" : "مرفوض"} · بناء ${T.BUILD === "PASS" ? "سليم" : "مرفوض"} · دليل حيّ ${T.LIVE === "PASS" ? "سليم" : "مرفوض"} · الحكم: ${T.VERDICT === "GREEN" ? "أربع بوابات خضرا من أمر واحد" : "مرفوض"}.`,
  "",
];

const body = lines.join("\n");

const prose = body.replace(/`[^`]*`/g, "");
const strays = (prose.match(/[0-9]+/g) ?? []).filter((r) => !Object.values(T).map(String).join("").includes(r) && r !== "390" && r !== "2026" && r !== "2023");
const words = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !["prove", "ruler", "lands", "mjs", "scratch", "instruments"].includes(w));
if (body.includes("undefined") || body.includes("NaN")) throw new Error("a token had no measured value");

console.log(JSON.stringify(body));
console.log("appended lines:", body.split("\n").length - 2);
console.log("المقاس:", JSON.stringify(T), "today=" + today);
