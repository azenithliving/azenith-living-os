import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const ledgerPath = "docs/ledger/council-minutes.md";
const MARK = "رفّ الجاهز";
const ar = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x660 + Number(d)));

const addition = ar(`
- **وكيل المتجر (${new Date().toISOString().slice(0, 16).replace("T", " ")}):** **${MARK}:** المالك صحّح صورة المتجر بكلامه: شغله تشطيبات وأثاث حسب الطلب — الزائر يتفرّج على موديلات، يوصّل، يتفق، ياخد منه عربون، وبعدين ينزل يشتري الخامات. ومعاها أمر صريح: المتجر ملوش دعوة بالورشة ولا بالخامات ولا بالمخزون، واللي في جدول المنتجات دلوقت «غالبًا غباء من وكيل بنى المتجر قبل كده».
  - **المقيس قبل البناء:** 158 جدول، وفي جدول المنتجات سطر واحد — «صوفا ملكية» بلا سعر وبلا صورة وبلا قسم، والأقسام صفر. والسطر ده ما بيطلعش لعميل أصلاً، لأن صفحات الزائر ما بتقرا جدول المنتجات خالص: البيع عندنا بالكلام.
  - **اللي اتبنى:** صفحة «المتجر» للزائر على عنوان جديد، وفي الكابينة طاولة باسم «رفّ الجاهز» بيضيف منها قطعة — اسمها، سعرها، سطر يوصفها، تفاصيل، وصورته هو من الموبايل أو رابط. قاعدة واحدة بتحكم على السطحين: القطعة ما تظهرش للزائر غير لما يكون ليها سعر وصورة، والرفّ الفاضي بيقول للزائر «قريبًا» بدل شبكة فاضية، ومفيش زر مسح في الطاولة — الخبي رجعي والمسح كلمته.
  - **البرهان على الرابط المنشور (عرض 390 بكسل، دخول جديد، صور اتبصّ عليها):** الزائر: «قريبًا» واحدة، صفر كارت، و«المتجر» داخل القائمة. الطاولة: بابها في القائمة الجانبية، والسطر الوراثي معاه «ناقص: السعر، الصورة». سطر كتبته الآلة من على الطاولة نزل عند الزائر بسعر «٤٥٬٠٠٠ جنيه» بأرقامه مش باللاتيني، وبكلمة الخبي رجعت صفحة الزائر «قريبًا» تاني. سطر الاختبار تمسح في نفس اللفة والجدول رجع لواحد زي ما كان، وصفر رسالة خطأ في المتصفح.
  - **أربع عيوب طلعت من المشي واتقفلت:** (1) الباب كان بيلصق جملة القاعدة الإنجليزية قدام المالك لما السطر يرفض — بقت عربية على قد نوع العطل، وحارس بيمنع رجوعها. (2) الباب كان بيفترض إن حساب الدخول موظف مسجّل في دفتر العاملين، والدفتر فيه صفر سطور لإيميل البوابة — بقى بيتلمح بالبريد وبيسب فاضي لو مسجّلش. (3) زرار اختيار الصورة كان المتصفح بيرسمه بالإنجليزي — بقى بكلمة المتجر «اختار صورة من الموبايل» والمربع الحقيقي لسه شغال بالكيبورد والموبايل. (4) عيب في آلتي أنا: كود التحقق من البوابة اتولّد من غير ما أقول للمكتبة إن المفتاح base32، فتلات محاولات دخول اترفضت واتسجّلت عندي كأن البوابة مقفولة — البوابة سليمة والمفتاح المخزّن هو هو حرف بحرف، والفرق ده مسجّل هنا عشان أي وكيل يعيد المطاردة.
  - **اللي لسه واقف على كلمته:** القطع الحقيقية بأسمائها وأسعارها وصورها — دي عنده هو والوكيل ما يخترعش سعر. وسطر «صوفا ملكية» الوراثي: ظاهر في طاولته ومخفي عن الزائر، ومسحه كلمة صريحة مش قرار وكيل.
  - **البوابات:** 2127 اختبار أخضر (كانت 2108 — 19 جديد: 17 على الرفّ و2 على شاشات الموبايل) · تيبشك سليم · بناء كامل · تلات نشرات والقياس الحيّ بعد الأخيرة
`);

appendFileSync(ledgerPath, addition, "utf8");

const movementsPath = "docs/ledger/movements.json";
const m = JSON.parse(readFileSync(movementsPath, "utf8"));
const LIVE =
  " Live 2026-10-13 at 390px on the published alias, fresh sign-in: the visitor's page answered «قريبًا» with 0 cards, the desk showed the inherited row as «ناقص: السعر، الصورة», a piece typed on the desk reached the visitor with the price «٤٥٬٠٠٠ جنيه» in his own numerals, hiding it returned the page to «قريبًا», and the instrument's row was removed with the table counted back to 1 — 0 console errors.";
let touched = 0;
for (const row of m.rows) {
  if (String(row.atom).includes("shop") && row.state === "moved" && !row.proof.includes("Live 2026-10-13")) {
    row.proof += LIVE;
    touched++;
  }
}
const text = readFileSync(ledgerPath, "utf8");
console.log(`ledger has the line: ${text.includes(MARK)} · movements touched=${touched}`);
if (touched !== 3) {
  console.log("REFUSING TO WRITE movements.json — expected 3 shelf rows, found " + touched);
  process.exit(1);
}
writeFileSync(movementsPath, JSON.stringify(m, null, 2) + "\n", "utf8");
const back = JSON.parse(readFileSync(movementsPath, "utf8"));
const withLive = back.rows.filter((r) => String(r.proof ?? "").includes("Live 2026-10-13")).length;
console.log(`movements rows=${back.rows.length} · carrying the live proof=${withLive}`);
