import { readFileSync, writeFileSync } from "node:fs";

/** بند ١٩ rewritten from the record's own numbers, not from a file count. */

const PATH = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const TICK = String.fromCharCode(96);
const ar = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x660 + Number(d)));

const to = "19. **قاعدة عملاء بالهاتف + ذاكرة دلالية بالمتجهات لتفضيلات كل زبون** — *مش مبني* — القياس من السجل النهاردة ([[scratch/census-customer-memory.mjs]]) بدل عدّ الملفات: **ذاكرة العميل = صفر سطر**. جدول التفضيلات موجود بس شكله غير اللي بيقوله الكود (ست أعمدة ناقصة) فالكتابة بترفض ([[42703]]) والرفض بيبلع في [[catch]] — يعني ما كانش فيه ولا تفضيل محفوظ من يوم ما اتعمل. ذاكرة السرب المتجهية **صفر سطر** مع قارئ حيّ في كل ردّ شات. وفيه جدول متجهات تاني **مش موجود أصلاً** وبابين مستنياه، و 891 متجه قديم ببُعد 1536 من 2026-04-20 والمولّد النهارده بيطلع 768. اللي عند الدار النهارده: 150 جلسة، 2 منها بس حاملة طراز/ميزانية/منطقة، و 11 ورقة لـ 5 عملاء بـ 6 ورق ألوان مختارة — كلها مربوط بالجلسة بيموت بموتها. **القرار:** ذاكرة بمفتاح العميل نفسه ([[phone:...]])، بتكتب من ورقه واتصاله وبتتقرا في ملفه الذهبي وورقته، نصّية تشتغل بصفر مفتاح، والمتجه إضافة بعدها.";

const file = readFileSync(PATH, "utf8");
const lines = file.split(/\r?\n/);
const i = lines.findIndex((l) => l.startsWith("١٩. **قاعدة عملاء بالهاتف"));
if (i === -1) {
  console.log("REFUSING: بند 19 not found");
  process.exit(1);
}
lines[i] = to.replace(/\[\[([^\]]+)\]\]/g, (_m, inner) => TICK + inner + TICK).split(new RegExp(`(${TICK}[^${TICK}]*${TICK})`, "g")).map((p) => (p.startsWith(TICK) ? p : ar(p))).join("");

// The recount that follows from this item moving state.
const recount = ar(`

- **عدّ تاني للعدد بعد قياس البند 19 (نفس اليوم):** البند 19 اتنقل من «مبني — بلا دليل» لـ «مش مبني» لأن القياس لقى الكتابة بترفض من أول يوم والسطر المحفوظ = صفر. يبقى من 54 بند: **27 مُثبت بدليل**، و **24 مبني من غير دليل**، و **3 مش مبني** (تطهير مفاتيح البيئة، ومسح اللوحة القديمة — متعمد بفرامل المالك، وذاكرة العميل). النسبة: **48٪ كامل و 50٪ بالجزئي** (بند الإتاحة لسه جزئي).
`);

const outside = (lines[i] + recount).replace(new RegExp(`${TICK}[^${TICK}]*${TICK}`, "g"), "");
const latin = [...new Set([...outside.matchAll(/[A-Za-z]{3,}/g)].map((m) => m[0]))];
const digits = [...outside.matchAll(/[0-9]/g)].length;
if (latin.length || digits) {
  console.log(`REFUSING: Latin leaked — ${latin.slice(0, 10).join(", ")} digits=${digits}`);
  process.exit(1);
}

writeFileSync(PATH, lines.join("\n") + recount, "utf8");
console.log(`patched line ${i + 1} · item 19 rewritten from the record, and the recount appended`);
