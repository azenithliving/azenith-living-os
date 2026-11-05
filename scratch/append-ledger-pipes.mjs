import { appendFileSync, readFileSync } from "node:fs";

/** A follow-up on the glyph minute: the number after the pipe pass, with the marker that only this build satisfies. */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const ledgerPath = "docs/ledger/council-minutes.md";
const MARK = ar("وتاني في نفس اليوم: الفواصل المرسومة");

const ledger = readFileSync(ledgerPath, "utf8");
if (ledger.includes(MARK)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}
const proof = readFileSync("scratch/bidi-after5.out", "utf8");
if (!/new build live \(cockpit clean, inline pipe flattened\)/.test(proof)) {
  console.log("REFUSING TO WRITE: the marker that only this build satisfies never landed.");
  process.exit(1);
}
const m = proof.match(/\{"operator":(\d+),"brackets":(\d+),"arrows":(\d+),"bare-latin":(\d+)\}/);
if (!m) {
  console.log("REFUSING TO WRITE: no totals in the proof file.");
  process.exit(1);
}
const [operator, brackets, arrows, latin] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
const total = operator + brackets + arrows + latin;

const addition = ar(`
- **وكيل المتجر (${new Date().toISOString().slice(0, 16).replace("T", " ")}):** **${MARK}:** الفاصل اللي الموديل كان بيحشه وسط الجملة العربية بقى نقطة وسطى، والجداول ما لمستهاش (الجدول بيتقسم بيه بعد الترجمة). **الإجمالي على شاشاته العشرة: 64 شكل يقلّب الاتجاه بقوا ${total} — عامل ${operator} · قوس ${brackets} · سهم ${arrows} · كلمة لاتينية ${latin}.** اللي فضل من «العامل» كله حساب («٢× = ٥٤٠٠٠ ج.م» و«+ ٢ فوتيه»): ده مش حرف بيتبدل بحرف، ده سطر لازم يتارسم قائمة أو جدول عشان يقرأه صح — مسجّل كخطوة جاية. **الدرس المسجّل تاني:** العلامة اللي بتستنى بيها البناء الجديد لازم تكون حاجة ما تنجزش إلا بالبناء ده — أول علامتين عدّوا على البناء القديم وقالوا «جديد»، والرقم اللي بينهم كان بيقيس نفس الشاشة.
`);

appendFileSync(ledgerPath, addition, "utf8");
const after = readFileSync(ledgerPath, "utf8");
console.log(`operator=${operator} brackets=${brackets} arrows=${arrows} latin=${latin} total=${total}`);
console.log(`written: ${after.includes(MARK)} · file lines: ${after.split(/\r?\n/).length}`);
