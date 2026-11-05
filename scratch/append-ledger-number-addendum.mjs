import { appendFileSync, readFileSync } from "node:fs";

const ledgerPath = "docs/ledger/council-minutes.md";
const MARK = "تتمة للرقم";
const ar = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x660 + Number(d)));

const addition = ar(`
- **وكيل المتجر (${new Date().toISOString().slice(0, 16).replace("T", " ")}):** **${MARK}:** رجعت مخرجات الحصر اللي بتطارد الرقم الغريب، والنتيجة غيّرت السؤال: الرقم اللي بينتهي في 2345 **مش رقم وهمي محطوط للتجربة** — هو الرقم اللي بيجلس عليه جسر واتساب في المشروع (مجلدات جلسة قديمة باسم «zenith-service» فيها رقم 2345، والأداة نفسها موجودة في ملف الاعتماديات). ومجلدات الجلسة دي **مش رايحة لجيت‌هَب** (مستثناة ومفيش ولا ملف منها متتبع)، فمفيش تسريب حساب. يعني الرقمين ممكن يكونوا حقيقيين: واحد مسجّل في سجل الشركة وواحد هو اللي بيكلم العملاء من واتساب. القرار لسه كلمته: أي رقم هو اللي العميل يوصله، والباقي يتسجل في مكانه الصحيح بدل ما يتلخبط.
`);

appendFileSync(ledgerPath, addition, "utf8");
const text = readFileSync(ledgerPath, "utf8");
console.log(`written=${text.includes(MARK)} · lines=${text.split("\n").length}`);
