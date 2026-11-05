import fs from "node:fs";

/** Appends the witness measurement to the repository ledger. Numerals are generated, never typed. */
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
const AI = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const lines = [
  "",
  `- **وكيل المتجر (${when}):** **قياس الشهود: جوجل بيرفض من النشر وبينجح من هنا، والشاهد اللي على الجهاز موجود بس متروك.**`,
  "  - **القياس:** نفس الرسم اتسأل له كل شاهد لوحده. جوجل ردّ صح من جهازي (قرأ ٤٫٥٠ من الورقة)، وهو نفسه اللي ردّ «٤٠٣ — المشروع محروم» من النسخة المنشور من ساعة. يعني المفتاح اللي بيخدم النشر مش هو اللي بيخدم الشغل المحلي — وده بيلحق ببند المفاتيح اللي مصدرها مش موثّق. بوّابتا الأنثروبيك والأوبن إيه اتقاست باسم دالة غلط عندي، فالسلسلة اللي المفروض تكون احتياطياً لسه متقاستش خالص.",
  "  - **المكتشف الأهم:** محرك القراءة على الجهاز (تِسيرَاكت) شغّال فعلاً وطلع ٤٫٥ من الورقة لوحده — لكن الباب بيسأله «لأ» (runOffline: false)، فالنظام بيرمي الشاهد الوحيد اللي مفيش حد يقدر يمنعه وتكلفته صفر.",
  "  - **القرار:** الشاهد التاني يتوصّل: لما السحابة ترفض، الجهاز يقرا، والفرق بينهم يتقال للمالك في السطر (قارئ الجهاز مش شاهد تاني موثّق). وبعدها المفاتيح تتحصر: أنهي مفتاح جوجل بيخدم النشر فعلاً.",
  "",
];

const body = AI(lines.join("\n"));
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !when.includes(r));
if (strays.length) throw new Error(`Latin digits left: ${strays.join(", ")}`);
fs.appendFileSync("docs/ledger/council-minutes.md", body, "utf8");
console.log("appended lines:", lines.length - 2);
