/**
 * make-bell-ledger-msg.mjs — the ledger commit line, copied from the measured token sheet.
 *
 * The appender printed the values it used; this reads that print, so no digit is typed by hand.
 */
import fs from "node:fs";

const out = fs.readFileSync("scratch/bell-ledger2.out", "utf8");
const json = /المقاس: (\{[\s\S]*?\}) today=/.exec(out)?.[1];
if (!json) throw new Error("the appender did not print its token sheet");
const T = JSON.parse(json);
for (const [k, v] of Object.entries(T)) {
  if (v === undefined || v === null || v === "") throw new Error("token has no value: " + k);
}
const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));

const msg =
  `docs(ledger): سطر الجرس التاني اتقاس ونُشر — الدليل الحيّ ${AR(T.PROOF)} من ${AR(T.PROOF_TOTAL)} على الرابط المنشور` +
  ` · الباب يردّ بـ${AR(T.DOOR_FIELDS)} حقول والجرس كان بيعلن ${AR(T.B_DECLARED)} منهم ${AR(T.B_PHANTOM)} مالوش وجود و بيسيب ${AR(T.B_IGNORED)} حقول ساكنة` +
  ` · كان بيقرا ${AR(T.B_ASKED)} و يعرض ${AR(T.B_SLICED)} · و التعليم كمقروء كان بيجاوب على نفسه من غير ما يسمع ردّة الباب` +
  ` · والزرّ اللي تحت كان شغلته تقفل الشريط بس · ومفيش شاشة مركّبا عليه (${AR(T.B_MOUNTED)})` +
  ` · بقى حقوله ${AR(T.A_DECLARED)} والعدد وجملة السكون من الباب والسؤال والعرض ${AR(T.A_ASKED)} · والجملة اللي بتسمّي الرفض اللي مش عربي بقى لها مالك واحد فالشاشتين ما يختلفوش` +
  ` · وعلى النسخة الحيّة: النشرة اللي بتوصل فورها ${AR(T.TABLES)} جدول، مفيش منهم جدول الأحداث القديم (${AR(T.DEAD_COLS)} عمود، ${AR(T.DEAD_ROWS)} سطر آخر كتابة ${T.DEAD_DATE})` +
  ` ولا دفتر المتجر (${AR(T.LEDGER_ROWS)} سطر) · فالاشتراك اللي كان بيفتح هناك بقى يرفض ويسمّي السبب` +
  ` · والقياس الحيّ قال: رفض الباب بـ${AR(T.REFUSAL_BYTES)} حرف عربي، والكارت عند ${AR(T.CARD_WIDTH)} بكسل بـ${AR(T.CARD_LATIN)} رقم لاتيني و${AR(T.CARD_ARABIC)} رقم عربي وكونسول ${AR(T.CONSOLE_ERRORS)}` +
  ` · و${AR(T.NOT_MEASURED)} قياس اتسجّل «ما اتقارش» لأن الشارة كانت ساكنة` +
  ` · وعيوب في مِقياسي اتصلّحت: كان بيعدّ ملف التعريف كمستخدم، وكان بيطمّن على شكل سطر ما كانش موجود، وخطأ كونسول كان من طلب الأداة نفسها` +
  ` · ${AR(T.TESTS)} اختبار · ${AR(T.GUARDS)} حارس في الملفين دول · ومفيش سطر في الدفتر اتغيّر ولا حاجة اتمسحت`;

const prose = msg.replace(/^docs\(ledger\): /, "");
const latin = (prose.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => w !== "scratch");
if (latin.length) throw new Error("Latin words leaked: " + latin.join(", "));
if (/[0-9]/.test(prose)) throw new Error("Latin digits leaked");
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(msg)) throw new Error("a non-Arabic script leaked");
if (msg.includes("undefined") || msg.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/ledger-msg.txt", msg, "utf8");
console.log(msg);
