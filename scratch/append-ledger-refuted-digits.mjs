import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

/**
 * The first run of this minute went out with Latin counts inside the Arabic text (the placeholders
 * were substituted after the digit pass). This rewrites that block in place instead of appending a
 * second copy — the ledger keeps one record per atom.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const now = new Date();
const stamp = ar(
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
    now.getUTCDate()
  ).padStart(2, "0")} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`
);

const QUOTE_MONEY = "@@MONEY@@";
const QUOTE_BEFORE = "@@BEFORE@@";
const QUOTE_PATH = "@@PATH@@";

const minute = `
- **وكيل المتجر (${stamp}):** **مُقيَسة ومرفوضة: أرقام جسم ردّ الموظف بتتكتب بأرقامه هو من زمان — اللي غلطان كان قراءتي لصورة صغيرة.**
  - **اللي اتسجّل خطوة:** بعد صورة محادثة القائد على المنشور قلت «الرد بيقول المبيعات: ${QUOTE_MONEY} بأرقام لاتينية» وسجّلتها خطوة مستقلة.
  - **القياس بالتلاتة:** (١) شغّلت قارئ صوت الموظف على نفس السطر المخزّن: قبل «${QUOTE_BEFORE}» → بعد «٧٠٠٠٠٠ ج.م من ٢ طلب»، وصفر رقم لاتيني فاضل · (٢) على آخر ${ar("6")} سطور: ${ar("5")} منهم صفر، والسادس فيه ${ar("26")} رقم كلهم جوّه مسار موقع · (٣) على الشات المعروض نفسه بعرض ${ar("390")}: ${ar("87")} فقاعة، ${ar("91")} رقم لاتيني، والواقعة لوحدها منها ${ar("0")} — الباقي كله داخل روابط زي «${QUOTE_PATH}»، والقاعدة بتاعتك إن الرابط يُسمح بيه كعنصر لوحده.
  - **الحكم:** الخطوة اتسجلت غلط، ومفيش حاجة اتبنيت. التحويل ده موجود من ذرّة تقارير الموظفين (\`DIGITS\` في \`lib/ops/owner-voice.ts\`)، واللي غلطان كان بصّي على الصورة مش القياس.
  - **اللي يفضل مفتوح من نفس الصورة (مش متسجّل كخطوة لحد ما يتقاس):** الرابط الحيّ للمعاينة بيطبع جوه الفقاعة كمسار آلة في نص عربي («معاينة: ${QUOTE_PATH}») — ده بيت لمّا يتقاس عدد السطور اللي بتعمل كده على شاشته.
`;

const final = Object.entries({
  [QUOTE_MONEY]: "700000 ج.م",
  [QUOTE_BEFORE]: "700000 ج.م من 2 طلب",
  [QUOTE_PATH]: "/api/admin/ops/preview/draft_1791332500628",
}).reduce((text, [from, to]) => text.split(from).join(to), ar(minute));

const PATH = "docs/ledger/council-minutes.md";
const MARK = "مُقيَسة ومرفوضة";
let file = readFileSync(PATH, "utf8");
const at = file.lastIndexOf(`\n- **وكيل المتجر (`);
const hasBlock = file.includes(MARK);
if (hasBlock && at >= 0) {
  file = file.slice(0, at).replace(/\s+$/, "") + "\n";
  console.log("previous copy of this minute removed");
}
writeFileSync(PATH, file + final, "utf8");

const written = readFileSync(PATH, "utf8");
console.log(`copies of the minute in the file: ${(written.match(new RegExp(MARK, "g")) ?? []).length}`);
console.log(written.split("\n").slice(-6).join("\n"));
