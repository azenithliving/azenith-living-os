import { appendFileSync, readFileSync } from "node:fs";

/**
 * The minute for the history round. The live numbers are read out of the proof file, and the script
 * refuses to write if the proof never saw the new build.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const MARKER = "التاريخ بقى بيتقرأ زي الرد الحيّ";

const ledger = readFileSync("docs/ledger/council-minutes.md", "utf8");
if (ledger.includes(MARKER)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const proof = readFileSync("scratch/history-scrub.out", "utf8");
if (!/new build live/.test(proof)) {
  console.log("REFUSING TO WRITE: the live proof never saw the new build.");
  process.exit(1);
}
const retiredLive = Number(proof.match(/مجموع الاسم المتقاعد على أربع شاشات محادثة: (\d+)/)?.[1] ?? NaN);
const consoleErrors = Number(proof.match(/خطأ كونسول: (\d+)/)?.[1] ?? NaN);
if (!Number.isFinite(retiredLive) || retiredLive !== 0) {
  console.log(`REFUSING TO WRITE: the published chat still shows the retired name (${retiredLive}).`);
  process.exit(1);
}

const now = new Date();
const stamp = ar(
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`,
);

const minutes = ar(`

- **وكيل المتجر (${stamp}):** **${MARKER}: الاسم المتقاعد كان عايش في 156 صف في تاريخه — بقى صفر، والمسودات بقت بتتقال بأسمائها.**
  - **أول ما القياس كشف إن المقدمة غلط:** أنا قلت «هخلي الموظفين يكتبوا عربي من المصدر» — والقانون ده موجود من 26 سبتمبر و**شغال**: صفوف الموظفين اللي فيها جُملة إنجليزي في آخر أسبوع 1 من 20 مقابل 225 من 850 قبله. يعني اللي على شاشته تاريخ مش كتاب جديد. من هنا القرار اتغيّر: التاريخ يتعامل معاملة الصف الجديد.
  - **مرور على 870 صف (كلام الإنتاج نفسه، مش نسخة منه):** **794 صف اتغيّر في اللفة الأولى، و151 في التانية، و40 في التالتة** — وبالقراية من القاعدة: صفوف فيها جُملة إنجليزي **296 → 255**، والاسم المتقاعد في صفوف الموظفين **156 → صفر**. اللي فضل 2 في صفوف **هو** (كلامه هو، وما لمستهش — الحدّ ما بيغيّرش كلمة المالك).
  - **عيبين طلعت من نفس المرور وما كنش حد شافهم:** (1) الحدود كانت بتسأل قاموس الأدوات بس، فـ«نوع المسودة» كان بيطير خالص ويسيب «— —» رغم إن مكتب المسودات بيسمّيه بالعربي من أسبوع — بقى «تنظيم المعرض» و«تصحيح الصورة». (2) الاسم المتقاعد كان بيتمسح من الردّ الحيّ فقط، فالصفوف القديمة بتعرّف السرب باسم دفنه المالك مرتين — وبقت الحدود بتتمسح في نفس الدالة اللي بتقرأ الصف.
  - **تسع صفوف فضلوا مستخبي ورا حرف ربط («وقيّم الدار»):** الحرّاس كان بيقول «أي حرف عربي قدامها = كلمة عادية» عشان «تقييم الدار» ما يتلمّش. اتعمل للحرف اللي بيلتصق (و ف ك ب ل) استثناء **للاسم المشدّد فقط**، والعادي فضل زي ما هو عشان «تقييم الدار» ما يتقطّعش. الاختبار بيغطي الاتنين.
  - **اللي اتعمل غلط واتصحح في نفس الجلسة:** أول نسخة من أداة المرور كانت بتحوّل المعرّف لرقم وهو **معرّف نصي** — فالكتابة كانت هتكتب في صفر صف وتقول «نجحت». مسكها التشغيل الاستباقي قبل الكتابة. وبعدين 40 صف فضلوا لأن الاستثناء ما كانش موجود.
  - **الدليل الحيّ:** أربع شاشات محادثة على الرابط المنشور بعرض 390 — **صفر** اسم متقاعد، ونوع المسودة مسمّى، و${consoleErrors} خطأ كونسول. لقطة: scratch/history-scrub-390.png
  - **البوابات:** 2047 اختبار أخضر (+10: 5 بتسأل الحدود مالها، 4 إن الاسم المتقاعد يمسح من التاريخ وما يلمّش الكلمة العادية، و1 إن الفقاعة بتنادي النهائية) · تيبشك سليم · بناء كامل · نشرتين والقياس بعده.
`);

appendFileSync("docs/ledger/council-minutes.md", minutes, "utf8");
const after = readFileSync("docs/ledger/council-minutes.md", "utf8");
console.log(`retiredLive=${retiredLive} consoleErrors=${consoleErrors}`);
console.log(`written: ${after.includes(MARKER)} · file lines: ${after.split(/\r?\n/).length}`);
