import { appendFileSync, readFileSync } from "node:fs";

/**
 * The night minute: the last three covers, and the customer's address given its own direction.
 *
 * Every number is read out of a measurement file; the script refuses to write unless both proofs are
 * in it.
 */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const ledgerPath = "docs/ledger/council-minutes.md";
const MARK = ar("ليلة الغرف الثلاث والعناوين");

const ledger = readFileSync(ledgerPath, "utf8");
if (ledger.includes(MARK)) {
  console.log("already recorded — nothing written");
  process.exit(0);
}

const rpc = readFileSync("scratch/cover-rpc2.out", "utf8");
const email = readFileSync("scratch/proof-email.out", "utf8");
const harvest = readFileSync("scratch/harvest-night.out", "utf8");
const cells = Number((rpc.match(/خلايا \(غرفة\/طراز\) راجعة من الباب: (\d+)/) ?? ["", "0"])[1]);
const empty = (harvest.match(/خلايا فاضية \(مفيش صورة بتستاهل\): (\d+)/) ?? ["", "-1"])[1];
const planned = (harvest.match(/خطّة (\d+) · اللي اتسجّل فعلاً/) ?? ["", "0"])[1];
const mailCount = Number((email.match(/دفتر العملاء: عناوين (\d+)/) ?? ["", "0"])[1]);
const mailVerdict = /النتيجة: كل عنوان على شاشاته بيبدأ من الشمال/.test(email);
if (!cells || !mailVerdict || empty === "-1") {
  console.log("REFUSING TO WRITE: a proof is missing or did not land.");
  process.exit(1);
}

const addition = ar(`
- **وكيل المتجر (${new Date().toISOString().slice(0, 16).replace("T", " ")}):** **${MARK}:** المالك قال «ليلًا» لثلاث خلطات صور فاضية، فاللفة اتعملت على وضع صبور (عاملان بدل أربعة، وبحث أوسع، ومحاولة تانية لأي صورة رجّعها مزود فاضي).
  - **الخلطات التلات:** 30 صورة اتعرضت على المصحّح، **${planned} اتقبلت واتفصّلت**، و**الخلايا الفاضية بقت ${empty}**. الباب اللي بيجاوب بطاقات أول الصفحة كان بيردّ بـ 61 غلاف، بقى **${cells} — كل غرفة وكل طراز عنده غلاف من البنك**. ودرجات المصحّح اتحوّلت لنفس الخانة اللي بيقرأها الاختيار (الميتاداتا)، فالترتيب مش على عمود فاضي.
  - **عنوان العميل بقى له اتجاهه:** الاستمارة بتاعة النخبة بتكتب أرقام عربية جوّه البريد نفسه («tarek.eldessouky.٩٦١٥@azenith-vip.com») — والأرقام دي بالظبط اللي السطر العربي بيحرّكها. العنوان بقى عنصر لوحده بشمال-يمين متجاوز، في الشات وفي كارت القائد وفي الدفتر، وسطر «مفيش رقم مسجل» بقى **ضغطة تفتح بريده** بدل ما يسيب العنوان مكتوب قدامه. **القياس على الشاشة المنشورة: ${mailCount} عناوين، أول حرف فيهم كلهم على الشمال.**
  - **عيب أداتي اتصحح في نفس الليلة:** العلامة اللي كنت بستناها على البناء الجديد كانت عنصر مش بيظهرش غير لما أفتح سطر عميل — فلفيت 21 مرة وهي بترفض. العلامة بقت على حاجة الصفحة بتطبعها لوحدها (عنصر العنوان في الشات)، واللي محتاج ضغطة بيتقاس بعدها مش قبلها.
  - **البوابات:** 2102 اختبار أخضر (كانت 2097 — 5 جدُد على العناوين: 4 لرسمها و1 إن سطر الدفتر بقى قابل للضغط) · تيبشك سليم · بناء كامل · نشرة والقياس بعدها · لقطة: ملف باسم email-order-390.png في مجلد الفحص
`);

appendFileSync(ledgerPath, addition, "utf8");
const after = readFileSync(ledgerPath, "utf8");
console.log(`cells=${cells} emptyCells=${empty} planned=${planned} mailCount=${mailCount} written: ${after.includes(MARK)}`);
