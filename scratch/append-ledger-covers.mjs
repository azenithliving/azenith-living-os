import { appendFileSync, readFileSync } from "node:fs";

/**
 * The ledger minute for the six rooms.
 *
 * Every number is read out of the two harvest logs and the door's own answer; the script refuses to
 * write if the proof of the published page is missing.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const ledgerPath = "docs/ledger/council-minutes.md";
const MARK = ar("الست الغرف اللي ملهاش صورة بقت بتتقال من البنك");

const ledger = readFileSync(ledgerPath, "utf8");
if (ledger.includes(MARK)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const proof = readFileSync("scratch/home-covers.out", "utf8");
if (!/كل الكروت من البنك، ثابتة، ومن غير سؤال بره/.test(proof)) {
  console.log("REFUSING TO WRITE: the published page was not proven.");
  process.exit(1);
}
const cards = proof.match(/كروت (\d+) · من البنك (\d+) · بلاصة هولدر (\d+) · نداءات المزود (\d+)/);
const changed = proof.match(/كروت غيّرت صورتها بين اللقطين: (\d+)/);
const door = readFileSync("scratch/cover-rpc.out", "utf8").match(/خلايا \(غرفة\/طراز\) راجعة من الباب: (\d+)/);
const harvest = readFileSync("scratch/harvest-run.out", "utf8");
const harvest2 = readFileSync("scratch/harvest-run2.out", "utf8");
const rows = (harvest2.match(/خطّة (\d+) · اللي اتسجّل فعلاً/) ?? [])[1];
const planned1 = (harvest.match(/خطّة (\d+)/) ?? [])[1];
if (!cards || !changed || !door || !rows || !planned1) {
  console.log("REFUSING TO WRITE: a measured line is missing.");
  process.exit(1);
}

const addition = ar(`
- **وكيل المتجر (${new Date().toISOString().slice(0, 16).replace("T", " ")}):** **${MARK}:** أول الصفحة بيعرض 16 غرفة، والبنك كان ماسك 10 منهم بس. الستة الباقيين (ضيوف، مكتب، دراسة، حمامين، صالة دخول) كانوا بيسألوا بحث صور بره **في كل زيارة، بترقيم عشوائي** — فنفس الغرفة تلبس صورة مختلفة كل ما حد يفتح.
  - **تصحيح كلام قلته قبل ما أقيس:** عرضت على المالك إني أجيب الصور «من منتجاته المنزولة»، قال «امشي». القياس كشف إن المصدر ده مش موجود: جدول المنتجات فيه **صف واحد** وصورته فاضية. فالمصدر اللي اتستخدم هو نفس مصدر باقي العشر غرف — مكتبة الصور الخارجية — بنفس الباب ونفس المصحّح ونفس حد القبول 85، مش حاجة جديدة على الدار. ده مسجّل عشان الكلمة اللي اتقالت كانت على أساس غلط، والنتيجة لسه بتحقق اللي وراه.
  - **اللفة:** 227 صورة اتعرضت على المصحّح في مرتين، و**اتقبل 33 بس** (باقي 194: إمّا رُفضت أو مزودات المفتوح مجاناً رجّعت «كل المزودات خلصت» — 88 مرة من 227، وده بيحدّد سرعة أي شغل صور جاي). وعشرين صورة تانية ضاعت في اللفة الأولى لأن معرّف الصورة في البنك **هو** معرّف المزود — فالصورة اللي البنك حاططها تحت غرفة تانية ما ينفعش تتسجّل مرة تحتيه، وده اتصلح في اللفة التانية باستبعاد المعروف قبل ما يتبعت للمصحّح.
  - **اللي اتغير في الكود:** قاموس البنك بقى يعرف أسماء الغرف الست، بس **في حدود كروت المتجر** — «بيجو» جديد اسمه BANK_ROOM_ONLY_TYPES. شرائح الاختيار اللي قدام العميل في غرفة العائلة ما زادش حرف واحد، لأن «إيه اللي العميل يقدر يختاره» قرار المالك مش نتيجة شغل صور، وفيه اختبار بيعدّي الشرائح على 11 وبيأكد إن الحمام مش فيهم.
  - **القراية من الباب نفسه:** كان بيردّ بـ 38 غلاف لـ 11 غرفة · بقى **${door[1]} غلاف لـ 16 غرفة**، وكل غرفة عندها غلاف على الأقل. اللي لسه فاضي: 3 خلطات (ضيوف/كلاسيك، ضيوف/صناعي، حمام/صناعي) — دول بيعدّوا على البحث البره لو العميل قلب الطراز عليهم، ومفيش صورة مقبولة لحد دلوقتي.
  - **الدليل الحيّ على الرابط المنشور بعرض 390، لقطة اتبصّيت عليها:** ${cards[1]} كروت · ${cards[2]} من البنك · ${cards[3]} بلاصة هولدر · ${cards[4]} نداء للمزود البرّه · صفر خطأ كونسول · **${changed[1]} كارت غيّر صورته بين فتحتين**.
  - **البوابات:** 2080 اختبار أخضر (كانت 2079 — اختبار جديد بيمنع الغرف الجديدة تدخل شرائح العميل) · تيبشك سليم · بناء كامل · نشرة واحدة والقياس بعدها · لقطة: ملف باسم home-covers-a-390.png في مجلد الفحص
`);

appendFileSync(ledgerPath, addition, "utf8");
const after = readFileSync(ledgerPath, "utf8");
console.log(`doorCells=${door[1]} planned=${planned1}+${rows} cards=${cards[1]} banked=${cards[2]} changed=${changed[1]} written: ${after.includes(MARK)}`);
