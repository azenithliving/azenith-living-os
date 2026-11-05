import { readFileSync, writeFileSync } from "node:fs";

/**
 * A follow-up line under today's item-48 measurement: the count moved twice after it was written,
 * because the first number was taken before the sources and the boundary were fixed. The original
 * bullet stays — the file is a record of what was measured when, not a claim that is always current.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const file = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const text = readFileSync(file, "utf8");

const ANCHOR = ar("والتلاتة الأخيرين مسموحين بقراره.");
const MARK = "وبعدها في نفس اليوم: ١٣٧ بقوا ١١٤";

if (!text.includes(ANCHOR)) {
  console.log("anchor not found — nothing written");
  process.exit(1);
}
if (text.includes(MARK)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const addition = ar(` **وبعدها في نفس اليوم: 137 بقوا 114** — اتقفلت خمس مصادر بكتابة إنجليزي بنفسها (تقرير الموافقة كان بيلصق الأمر خام، شريط الأحداث بيطبع نوع الصف، كارتين في اللوحة القديمة «AI» و«A/B»، باب الأوامر بيرفض بتسعاشر جملة إنجليزي وبينبّه على تليجرام بالإنجليزي)، وبعدين اتوصل حدّ كلام المالك بأربع شاشات كانت بيطبع العمود المخزّن كما هو (سطر الرفض في الطاولة · جسم كارت الموافقة · عنوان المهمة · عنوان الصف) — ده كان السبب إن جولتين كاملتين ما حرّكوا الرقم. اللي فضل: 61 موضع إنجليزي جوه كلام الموديل نفسه (اللي بيتكتب دلوقتي بيعدّي على الحرّاس، والقديم مخزّن) · 53 مسموح بقراره. والقاعدة الجديدة: جُملة إنجليزي كاملة ما بتترجمش كلمة كلمة — «is» و«currently» بيتقطّعوا لكلام مكسور، فالجملة تتصلح في مصدرها.`);

writeFileSync(file, text.replace(ANCHOR, ANCHOR + addition), "utf8");
const after = readFileSync(file, "utf8");
console.log("written:", after.includes(MARK), "| file lines:", after.split(/\r?\n/).length);
