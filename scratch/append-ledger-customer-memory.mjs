import { appendFileSync, readFileSync } from "node:fs";

/**
 * The ledger line for the day the customer memory was measured instead of counted from file names.
 */

const TICK = String.fromCharCode(96);
const ar = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x660 + Number(d)));

const body = `

- **وكيل المتجر (2026-10-15 08:05):** **ذاكرة العملاء: اتقاست من السجل، مش من عدد الملفات.** البند كان مكتوب فيه «كود المتجهات في 34 ملف بس مفيش دليل» — الرقم ده من الملفات، والملفات مش قدرة. القياس ([[scratch/census-customer-memory.mjs]]) جاوب بأربع أسئلة:
  - **ذاكرة السرب المتجهية** ([[ops_semantic_memory]]، بُعد 768، وفهرس [[HNSW]] شغال): **صفر سطر**. والقارئ بتاعها **متوصّل حيّ** في كل ردّ شات بتاع المالك ([[lib/agents/AgentOrchestrator.ts]] السطر 354 → [[recallMemory]]) — يعني الجملة «ذاكرتك عن موضوعات مشابهة» ما ظهرتش مرة واحدة من يوم ما اتكتبت. والكاتب الوحيد باب ما بيفتحوش ولا سطح ([[app/api/admin/ops/route.ts]]، فرع تخزين الذاكرة)، ولا مهمة مجدولة بتكتب فيه. **القارئ حيّ والمنبع ميت.**
  - **ذاكرة تفضيلات العميل** ([[user_preferences]]): الجدول موجود بس شكله [[user_id + preferences]]، واللي بيقول الكود [[category / key / value / confidence / source / last_confirmed]] — **ست أعمدة مش موجودة**، فالكتابة بترفض (42703) والرفض كان بيبلع في [[catch]] بيطبع في الكونسول بس. **النتيجة: صفر سطر من يوم ما اتعمل.** نفس عائلة العيب التالتة النهاردة: فشل صامت، والسطح بيقول «تمام».
  - **جدول متجهات تاني** ([[vanguard_embeddings]]): **الجدول نفسه مش موجود**، وفيه بابين ([[app/api/vanguard/memory/embed]] و [[.../search]]) ونواة وعاء مستنياه — قدرة وهمية بباب مفتوح. وفيه [[neural_knowledge]] فيه 891 متجه بس ببُعد 1536 من 2026-04-20، والمولّد النهارده بيطلع 768 — يعني مخزون قديم ببُعد غلط.
  - **العميل النهارده بيعرف بإيه؟** 150 جلسة مسترشد: **2 بس** اللي حاملة طراز/ميزانية/منطقة/اسم، و **صفر** حامل رقم تليفون جوه الجلسة — لأن الرقم ما بيتسجلش في الجلسة أصلاً (مفيش عمود). اللي عليه صاحب من ورق المقاسات: **11 من 34** لـ **5 عملاء**، و **6 ورق** فيها ألوان مختارة. يعني: **مفيش ذاكرة بتعيش بعد التاب**، وكل معرفة الدار بالعميل بتموت مع الجلسة.
  - **القرار اللي خرجت بيه (مش سؤال ليه):** الذاكرة تتعمل بمفتاح العميل نفسه — مفتاح الدفتر [[phone:...]] — مش بمفتاح الجلسة. **منبع:** أي ورقة أو اتصال بييجي منه رقم بيتكتب تحت مفتاحه: طرازه، ألوانه، منطقته، غرفته، ميزانيته لو قالها. **مستهلك:** أول ما يفتح ورقته أو يتصل بيه المالك، الملف الذهبي والورقة يقولوا «زي آخر مرة: مودرن · رمادي وبيج»، والمستشار لو كتب رقمه يفتكره. **القاع الصفري:** التخزين نصّي وبيشتغل من غير ولا مفتاح نموذج؛ المتجه إضافة بعدها، مش أساس.
  - **البوابات:** مفيش كود اتغيّر في اللافة دي — قياس مقروء من السجل الحيّ، والرقم اللي فوق من عدّ السطور مش من الانطباع.
`;

const converted = body
  .replace(/\[\[([^\]]+)\]\]/g, (_m, inner) => TICK + inner + TICK)
  .split(new RegExp(`(${TICK}[^${TICK}]*${TICK})`, "g"))
  .map((part) => (part.startsWith(TICK) ? part : ar(part)))
  .join("");

const outside = converted.replace(new RegExp(`${TICK}[^${TICK}]*${TICK}`, "g"), "");
const latinWords = [...new Set([...outside.matchAll(/[A-Za-z]{3,}/g)].map((m) => m[0]))];
const latinDigits = [...outside.matchAll(/[0-9]/g)].length;
if (latinWords.length || latinDigits) {
  console.log(`REFUSING: Latin leaked — words=${latinWords.slice(0, 14).join(", ")} digits=${latinDigits}`);
  process.exit(1);
}

appendFileSync("docs/ledger/council-minutes.md", converted, "utf8");
console.log(`appended · ${converted.length} chars`);
