import fs from "node:fs";

/**
 * Master list: the region station's second door, and the journey's region stop.
 *   node scratch/update-master-list-chat-area.mjs
 *
 * The first edit replaces a whole line by its own heading (so no numeral has to be matched by
 * hand), and refuses to write unless exactly one line carries it. The second is an exact anchor.
 */
const path = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const AI = (s) => String(s).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const text = fs.readFileSync(path, "utf8");
const lines = text.split(/\r?\n/);

const LINE_MARK = "المنطقة لسه بتتسأل في باب واحد";
const hits = lines.map((l, i) => (l.includes(LINE_MARK) ? i : -1)).filter((i) => i >= 0);
if (hits.length !== 1) throw new Error(`علامة السطر موجودة في ${hits.length} سطر بدل واحد — ما اتكتبش`);

const NEW_LINE = AI(
  `   - **الباب التاني اتوصل (2026-10-08):** المسترشد بقى يقرأ منطقة العميل من كلامه هو ويحفظها على نفس الصف اللي بيحفظ فيه موبايله، من غير ما حد يطلب من العميل يكتب. مقاس على الحيّ: من 145 جلسة مسجلة، 25 فيها العميل نطق منطقته وما كانتش بتتسجل خالص. دلوقتي بتتسجل، والصف بيتقرا تاني قبل ما الباب يقول «سجلت»، والملف الذهبي عند المالك بيقول «منطقته من كلامه: التجمع».\n   - **الفرملة اللي منعته يكذب:** القارئ مسموحله بكلام العميل بس. جملة الدار اللي بتقول «إحنا شغالين فين» بتسمّي كل المناطق، ولو اتقرئت كانت سجلت كل عميل في مصر إنه في التجمع. التحكم السلبي على الحيّ: 25 سطر زوار في السجل، اللي عليه منطقة = 1.\n   - **فاضل في نفس البند:** الرادار لسه ما بيقرأش المنبع الجديد — كلام العميل مع المسترشد فيه منطقة، بس الذوق المسجل على نفس الصف (الغرفة والطراز) موجود لسطور الزوار الـ24 القديمة وبس.`,
);
lines[hits[0]] = NEW_LINE;

const FROM2 = "وفيها محطة مالهاش عنوان لسه: «المنطقة».";
let joined = lines.join("\n");
const n2 = joined.split(FROM2).length - 1;
if (n2 !== 1) throw new Error(`المفتاح التاني طابق ${n2} مرة بدل مرة — ما اتكتبش`);
joined = joined.replace(
  FROM2,
  AI("ومحطة «المنطقة» اللي ما كانش لها عنوان بقى لها عنوان: 11 شارة على ورقته، ومنطقته بتتسجل من ورقته أو من كلامه مع المسترشد، والمعرض بيقول على ذوق مين رتّب."),
);

fs.writeFileSync(path, joined, "utf8");
const check = fs.readFileSync(path, "utf8");
console.log(
  "محفوظ:",
  check.includes("الباب التاني اتوصل") && check.includes("بقى لها عنوان") ? "نعم" : "لأ",
);
