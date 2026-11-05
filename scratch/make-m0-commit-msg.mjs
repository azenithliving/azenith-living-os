/**
 * make-m0-commit-msg.mjs — the M0 commit line, built only from numbers a command printed.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

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
  if (!m) throw new Error("no measured value for " + label);
  return m[1];
}

const T = {
  GATE_TESTS: token(gate, /(\d+) اختبار ·/, "gate tests line"),
  GATE_PASSED: token(gate, /· (\d+) أخضر ·/, "gate passed"),
  GATE_FAILED: token(gate, /· (\d+) أحمر ·/, "gate failed"),
  GATE_SKIPPED: token(gate, /· (\d+) متخطّى/, "gate skipped"),
  TYPECHECK: token(gate, /^typecheck=(\S+)/m, "typecheck state"),
  BUILD: token(gate, /^build=(\S+)/m, "build state"),
  LIVE: token(gate, /^live=(\S+)/m, "live state"),
  GATES: token(gate, /^GATES: (\S+)/m, "gates verdict"),
  ITEMS_TOTAL: token(ruler, /البند [0-9٠-٩]+ من ([٠-٩]+)/, "items total"),
  ITEMS_PROVEN: token(ruler, /البند ([٠-٩]+) من/, "items proven"),
  ATOMS_TOTAL: token(ruler, /الذرة [0-9٠-٩]+ من ([٠-٩]+)/, "atoms total"),
  ATOMS_MOVED: token(ruler, /الذرة ([٠-٩]+) من/, "atoms moved"),
  CENSUS_DATE: token(ruler, /الجرد من ([٠-٩-]+)/, "census date"),
  PHASE: token(ruler, /المرحلة ([٠-٩]+) من/, "phase number"),
  PHASE_TOTAL: token(ruler, /المرحلة [٠-٩]+ من ([٠-٩]+)/, "phase total"),
  MANIFEST_FILES: token(manifest, /scratch manifest: (\d+) files/, "scratch files"),
  MANIFEST_TOOLS: token(manifest, /· (\d+) instruments/, "scratch instruments"),
  MANIFEST_BYTES: token(manifest, /· (\d+) bytes/, "scratch bytes"),
  PROOF: token(proof, /^RESULT: (\d+) of/m, "proof passed"),
  PROOF_TOTAL: token(proof, /^RESULT: \d+ of (\d+)/m, "proof total"),
  UNIT: token(unit, /Tests\s+(\d+) passed/, "unit tests"),
  UNIT_FILES: token(unit, /Test Files\s+(\d+) passed/, "unit files"),
  TOOLS_IN_FOLDER: fs.readdirSync("scripts/instruments").filter((f) => f.endsWith(".mjs")).length,
  TRACKED_IN_REPO: execSync("git ls-files scratch", { encoding: "utf8" })
    .split(/\r?\n/)
    .filter((line) => line.trim()).length,
};

for (const [k, v] of Object.entries(T)) {
  if (v === undefined || v === null || v === "") throw new Error("token has no value: " + k);
}
if (T.GATES !== "GREEN") throw new Error("the gate command did not go green: " + T.GATES);
if (T.TYPECHECK !== "PASS" || T.BUILD !== "PASS" || T.LIVE !== "PASS") throw new Error("a gate refused");
if (T.GATE_FAILED !== "0") throw new Error("the suite reported failures: " + T.GATE_FAILED);
if (T.PROOF !== T.PROOF_TOTAL) throw new Error("the live proof failed a check");

const latinToArabic = (s) => String(s).replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));

const msg =
  `build(ruler): المِسطرة بقت أمر واحد — البوابات الأربع والعدد التلاتة بسطر واحد، واللي ما اتقارش يتسمّى` +
  `\n\n` +
  `القياس: الأمر ردّ «${latinToArabic(T.GATE_TESTS)} اختبار (${latinToArabic(T.GATE_PASSED)} أخضر · ${latinToArabic(T.GATE_FAILED)} أحمر · ${latinToArabic(T.GATE_SKIPPED)} متخطّى)» ` +
  `وتيبشك ${T.TYPECHECK === "PASS" ? "سليم" : "مرفوض"} وبناء ${T.BUILD === "PASS" ? "سليم" : "مرفوض"} ودليل حيّ ${T.LIVE === "PASS" ? "سليم" : "مرفوض"} · ` +
  `السطر بقى يقول: المرحلة ${T.PHASE} من ${T.PHASE_TOTAL} · البند ${T.ITEMS_PROVEN} من ${T.ITEMS_TOTAL} مُثبت بدليل · الذرة ${T.ATOMS_MOVED} من ${T.ATOMS_TOTAL} اتنقلت · الجرد من ${T.CENSUS_DATE}` +
  `\n\n` +
  `اللي كان ومالوش أمر: أدوات البرهان كانت في مجلد واحد الاستعمال — ${latinToArabic(T.MANIFEST_FILES)} ملف، ${latinToArabic(T.MANIFEST_TOOLS)} أداة، ` +
  `${latinToArabic(T.MANIFEST_BYTES)} بايت — و${latinToArabic(T.TRACKED_IN_REPO)} ملف بس منهم كان محفوظ في المستودع، والباقي كان أقرب حاجة تتضيع. ` +
  `بقى ${latinToArabic(T.TOOLS_IN_FOLDER)} أدوات محفوظة في مجلد الأدوات، ` +
  `وحارس يرفض إن نسخة ترجع في المجلد القديم، وسجل جديد يسمّي كل ملف لسه هناك (عدد · أدوات · بايتات)` +
  `\n\n` +
  `عيب حقيقي طلع من المِسطرة نفسها: الجرد اللي بيتحسب منه العدد تاريخه ${T.CENSUS_DATE}، وكان ممكن يتقال كأنه النهاردة — ` +
  `بقى السطر يحمل تاريخ الجرد نفسه لما يكون غير النهاردة · وعيب في مِقياسي: أول محاولة شغّلت الأداة بمشغّل سكربتات تايب‌سكربت فشلّت لأن اسم المسار المختصر ما اتحلّش، ` +
  `فاتنقل المنطق لطبقة عليها اختبارات والسكربت بقى قشرة تشغيل بس` +
  `\n\n` +
  `البوابات: ${latinToArabic(T.UNIT)} اختبار جديد في ${latinToArabic(T.UNIT_FILES)} ملف (المِسطرة والبوابات وقائمة الملفات) · ` +
  `الدليل الحيّ ${latinToArabic(T.PROOF)} من ${latinToArabic(T.PROOF_TOTAL)} على الرابط المنشور عند عرض ٣٩٠ بكسل · صورة اتبصّيت عليها`;

const prose = msg.replace(/^build\(ruler\): /, "");
const latin = prose.match(/[A-Za-z]{3,}/g) ?? [];
if (latin.length) throw new Error("Latin words leaked: " + latin.join(", "));
if (/[0-9]/.test(prose)) throw new Error("Latin digits leaked");
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(msg)) throw new Error("a non-Arabic script leaked");
if (msg.includes("undefined") || msg.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", msg, "utf8");
console.log("measured:", JSON.stringify(T));
console.log("---");
console.log(msg);
