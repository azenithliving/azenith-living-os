import fs from "node:fs";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const proof = stripAnsi(fs.readFileSync("scratch/prove-relations-door-reads.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/relations-fullsuite.out", "utf8"));
const doorTestSource = fs.readFileSync("tests/intel-relations.test.ts", "utf8");

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const PROOF = num(/النتيجة: (\d+) نجح/, proof, "proof passed");
const PROOF_TOTAL = num(/نجح من (\d+)/, proof, "proof total");
const GAP = num(/truth total missing: (\d+)/, proof, "gap");
const STRANGER = num(/stranger with a forged header: status=(\d+)/, proof, "stranger");
const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests");
const doorPart = doorTestSource.slice(0, doorTestSource.indexOf('describe("Smart Agent API Contract"'));
const GUARDS = (doorPart.match(/^\s*it\(/gm) ?? []).length;

const T = { PROOF, PROOF_TOTAL, GAP, STRANGER, TESTS, GUARDS };

const body =
  "docs(ledger): سطر باب فحص العلاقات اتقاس ونُشر — القياس من طريقين في نفس الجولة اتطابق عمود عمود: الباب على الرابط المنشور، والسجل نفسه من وصلة مباشرة · الباب بقى بيسأل الجدول عن الأعمدة اللي الكود بيكتبها ويقرأ الرفض، فمفيش ولا جدول بيتقال عليه ما اتقريش، والفجوة الحقيقية (**{GAP}** أعمدة في جدول سجل الأحداث) بتتقال بالاسم بدل ما تتبلع في خضر · الدليل الحيّ **{PROOF}** نجحت من **{PROOF_TOTAL}**، والغريب اللي بيزوّر رأس الهوية متردّ (**{STRANGER}**) · **{TESTS}** اختبار أخضر · **{GUARDS}** حراس على الباب";

const toArabic = (s) =>
  s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const out = body
  .replace(/\{([A-Z_0-9]+)\}/g, (_, k) => String(T[k]))
  .split("\n\n")
  .map(toArabic)
  .join("\n\n");

const allowed = Object.values(T).map(String).join("");
const prose = out.replace(/^docs\(ledger\):\s*/, "");
const words = (prose.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
const strays = (prose.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
if (/[\u0590-\u05ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(out)) throw new Error("a non-Arabic script leaked");
if (/\{[A-Z_0-9]+\}/.test(out)) throw new Error("an unreplaced token survived");
if (out.includes("undefined") || out.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", out + "\n", "utf8");
console.log("المقاس:", JSON.stringify(T));
