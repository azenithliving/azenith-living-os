import fs from "node:fs";

/**
 * Master list item 15: the radar's second source, measured live.
 *   node scratch/update-master-list-radar-source.mjs
 * Replaces the whole line that carried the old «فاضل» by its own heading, and refuses to write
 * unless exactly one line matches.
 */
const path = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const AI = (s) => String(s).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const MARK = "الرادار لسه ما بيقرأش المنبع الجديد";
const NEW = AI(
  `   - **المنبع التاني اتوصل (2026-10-08):** الرادار بقى يحسب ذوق المنطقة من بابين: ألوان أوراقها، والطراز اللي طلبه زوارها في كلامهم مع المسترشد. مقاس على المنشور (عرض 390): ورقة التجمع بتقول «محسوب من ألوان ورقة عميل واحد وطراز زائر واحد… وطرازهم مودرن» وأول تمن صورها modern فعلاً؛ وورقة الشيخ زايد اللي مالهاش طلب مسجل فضلت بترتيبها القديم — التوسعة ما بتلمّش على حساب ذوق حد.
   - **عيبين اتصلح لأنهم طلعوا على المسرح الحيّ:** القارئ ما كانش بيعرف مفتاح البنك اللي الدار نفسه بيكتبه (modern) فسطر الطراز الحقيقي كان بيُحسب فاضي؛ والوعد بطراز ما كانش وراه صورة لأن شريحة الجودة في البنك لنفس الغرفة طراز واحد بالكامل — بقى بيتطلب شريحة تانية للطراز ده. ولو مفيش صورة منه لغرفته، السطر يقول «مالقاش صورة لغرفة زي غرفتك، فالرتبة على الجودة» بدل ما يدّعي.
   - **فاضل في نفس البند:** منبع المحادثة لسه نادر — سطر واحد بطراز وهو بتاعي. صفحة النماذج اللي فيها 21 سطر بطراز وغرفة ما بيسألش عن المنطقة، فالخطوة الجاية شارات المنطقة تتحط في نفس المكان اللي بيطلب منه ذوقه، ويتعبّى المنبع من عملاء حقيقيين من غير سؤال جديد في وشه.`,
);

const text = fs.readFileSync(path, "utf8");
const lines = text.split(/\r?\n/);
const hits = lines.map((l, i) => (l.includes(MARK) ? i : -1)).filter((i) => i >= 0);
if (hits.length !== 1) throw new Error(`علامة السطر موجودة في ${hits.length} سطر بدل واحد — ما اتكتبش`);
lines[hits[0]] = NEW;
fs.writeFileSync(path, lines.join("\n"), "utf8");
console.log("محفوظ:", fs.readFileSync(path, "utf8").includes("المنبع التاني اتوصل") ? "نعم" : "لأ");
