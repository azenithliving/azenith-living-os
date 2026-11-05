import { readFileSync, writeFileSync } from "node:fs";

/** بند ١٩: from «not built» to «proven», with the half that is still missing named out loud. */

const PATH = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const TICK = String.fromCharCode(96);
const ar = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x660 + Number(d)));

const to = "19. **قاعدة عملاء بالهاتف + ذاكرة لتفضيلات كل زبون** — *مُثبت بدليل* — اتقاس حيًّا على الرابط المنشور (عرض 390 بكسل، صور اتبصّ عليها): عميل اختار لونين وكتب منطقته على ورقته → **4 سطور اتسجلت تحت مفتاحه هو** (لونان + منطقة + غرفة، وكل سطر بدليله ومصدره)، وورقته الجديدة قالت **«الدار فاكر: ألوانه بيج دافئ ورمادي · منطقته التجمع · غرفته غرف المعيشة»** بأرقامه، وملف المكالمة عنده قسم «الدار فاكره» بنفس السطور. **العكس مقاس كمان:** عميل من غير تاريخ ورقته ما بتطبعش ولا بلوك ذاكرة، ومفيش تحت مفتاحه ولا سطر، والملف يقول «مفيش حاجة مسجلة عنه لحد دلوقتي». **اللي لسه ناقص في نفس البند:** المتجهات — الذاكرة دلوقتي نصّية بتشتغل بصفر مفتاح نموذج، والبحث بالمعنى ([[pgvector]]) ما اتعملش؛ وذاكرة السرب المتجهية لسه **صفر سطر** بقارئ حيّ ومنبع ميت.";

const block = ar(`

- **بند 19 اتقفل بالقياس (نفس اليوم، بعد الظهر):** ذاكرة العميل بقت بمفتاحه هو — «الدار فاكر: ألوانه بيج دافئ ورمادي · منطقته التجمع · غرفته غرف المعيشة» على ورقته الجديدة، و **4 سطور** تحت مفتاحه بمصدرها ودليلها، والسالب متقاس (عميل من غير تاريخ = ولا بلوك). العدد يبقى: **28 مُثبت بدليل**، و **24 مبني من غير دليل**، و **2 مش مبني** من 54 — يعني **52٪ كامل و 54٪ بالجزئي**. اللي لسه ناقص في البند: المتجهات (الذاكرة نصّية بصفر مفتاح) وذاكرة السرب الفاضية.
`);

const file = readFileSync(PATH, "utf8");
const lines = file.split(/\r?\n/);
const i = lines.findIndex((l) => l.startsWith("١٩. **قاعدة عملاء بالهاتف"));
if (i === -1) {
  console.log("REFUSING: item 19 anchor not found");
  process.exit(1);
}
lines[i] = to.replace(/\[\[([^\]]+)\]\]/g, (_m, inner) => TICK + inner + TICK).split(new RegExp(`(${TICK}[^${TICK}]*${TICK})`, "g")).map((p) => (p.startsWith(TICK) ? p : ar(p))).join("");

const patched = lines.join("\n") + block;
const mine = lines[i] + block;
const outside = mine.replace(new RegExp(`${TICK}[^${TICK}]*${TICK}`, "g"), "");
const latinWords = [...new Set([...outside.matchAll(/[A-Za-z]{3,}/g)].map((m) => m[0]))];
const latinDigits = [...outside.matchAll(/[0-9]/g)].length;
if (latinWords.length || latinDigits) {
  console.log(`REFUSING: Latin leaked — words=${latinWords.slice(0, 10).join(", ")} digits=${latinDigits}`);
  process.exit(1);
}
writeFileSync(PATH, patched, "utf8");

const items = patched.split(/\r?\n/).filter((l) => /^[0-9\u0660-\u0669]{1,2}\.\s+\*\*/.test(l));
const count = (s) => items.filter((l) => l.includes(s)).length;
console.log(`written · items=${items.length} · proven=${count("مُثبت بدليل")} · built-unproven=${count("مبني — بلا دليل")} · not-built=${count("— *مش مبني*")}`);
