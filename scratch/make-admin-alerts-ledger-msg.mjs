/**
 * make-admin-alerts-ledger-msg.mjs — the ledger commit line, copied from the measured token sheet.
 */
import fs from "node:fs";

const out = fs.readFileSync("scratch/admin-ledger2.out", "utf8");
const json = /المقاس: (\{[\s\S]*?\}) today=/.exec(out)?.[1];
if (!json) throw new Error("the appender did not print its token sheet");
const T = JSON.parse(json);
for (const [k, v] of Object.entries(T)) {
  if (v === undefined || v === null || v === "") throw new Error("token has no value: " + k);
}
const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));

const msg =
  `docs(ledger): سطر صفحة التحكم القديمة اتقاس ونُشر — الدليل الحيّ ${AR(T.PROOF)} من ${AR(T.PROOF_TOTAL)} على الرابط المنشور` +
  ` · قاعدة التنبيهات بتعرف ${AR(T.TYPES)} نوع حدث و نافذة ${AR(T.WINDOW)} دقيقة والصفحة ما كانتش بتقرأ الباب اللي بيمرّ منهم` +
  ` · كانت بتطبع سطر «لا توجد تنبيهات حالية» من عندها وبتقطع عند ${AR(T.B_SLICE)} من غير ما تعدّ اللي فاضل، ومفيش مصدر مسمّى (${AR(T.B_SOURCES)})` +
  ` · وفي نصها العربي ${AR(T.B_TYPED)} رقم مكتوب لاتيني و${AR(T.B_RAW)} رقم بيمرّ زي ما هو` +
  ` · وعلى المنشور قبل التنقيط: الباب ردّ بـ${AR(T.WARNINGS)} رفض (${AR(T.WARNING_BYTES)} حرف) إن جدول محاولات الدخول يردّ على ${AR(T.TABLE_COLS)} عمود ومفيش فيهم عمود شركة، فالعدد كان ساكن ${AR(T.DOOR_COUNT)} وسطر الأمان ما كانش يقدر يظهر أبداً` +
  ` · بقى القراءة من الباب نفسه، وكل سطر عليه مين قاله (${AR(T.A_SOURCES)})، والفاضل بيتعدّ، والأرقام بحروفه (${AR(T.A_TYPED)} مكتوب و${AR(T.A_RAW)} بيمرّ)، والعمود الوهمي الفاضل ${AR(T.A_PHANTOM)}` +
  ` · والكارت عند ${AR(T.CARD_WIDTH)} بكسل بقى ${AR(T.NEW_CARD_BYTES)} حرف و${AR(T.CARD_ROWS)} سطر بـ${AR(T.CARD_LATIN)} رقم لاتيني و${AR(T.CARD_ARABIC)} رقم عربي وكونسول صفر` +
  ` · وشكّ من الصورة إن سطر العدّ مقلوب اتصلّح بالقياس: الرقم على يمين الكلمة (${AR(T.DIGIT_X)} مقابل ${AR(T.WORD_X)}) والاتجاه من اليمين للشمال` +
  ` · ${AR(T.TESTS)} اختبار · ${AR(T.GUARDS)} حارس في ملف التنبيهات · والفحص عنده ${AR(T.SA_COLS)} عمود وفيه ${AR(T.WATCH_PENDING)} تنبيه مفتوح والدفتر ${AR(T.LEDGER_ROWS)} سطر · ومفيش سطر في الدفتر اتغيّر`;

const prose = msg.replace(/^docs\(ledger\): /, "");
const latin = (prose.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => w !== "scratch");
if (latin.length) throw new Error("Latin words leaked: " + latin.join(", "));
if (/[0-9]/.test(prose)) throw new Error("Latin digits leaked");
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(msg)) throw new Error("a non-Arabic script leaked");
if (msg.includes("undefined") || msg.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/ledger-msg.txt", msg, "utf8");
console.log(msg);
