/**
 * P6-M4 — the refusal contract.
 *
 * «مش قادر» is a shrug, not an answer. Under the «صفر مفاجأة» rule every refusal
 * this swarm makes has to name the thing it is missing and the shortest way to
 * get it, so the owner learns which knob to turn instead of wondering whether
 * the machine is broken. The self-model already lists the swarm's real tools and
 * limits; this turns that inventory into the sentence.
 *
 * Pure: text in, text out. It never reads the database, so it can be argued with
 * in tests — including the case that matters most, an honest measured answer that
 * must NOT be decorated with a gap note.
 */

export interface GapFacts {
  tools: Array<{ name: string; desc: string }>;
}

export interface Gap {
  capability: string;
  enablePath: string;
  nearestTool: string | null;
}

/**
 * Sentences that mean "I cannot do this". The unavailable-*something* distinction
 * is deliberate and it is Arabic grammar doing the work: «غير متاحة» (feminine)
 * describes an أداة or قدرة — the swarm giving up — while «غير متاح» (masculine)
 * describes a رقم or قيمة, i.e. an honest report that a measurement came back
 * empty. Dressing the second one in a gap note would make the honest case look
 * broken.
 */
const CAN_NOT =
  "(?:مش|ما)\\s?(?:ه|ب)?أ?ق[ا]?در|لا\\s?أ?ستطيع|لا\\s?أ?قدر|عجزت|خارج نطاق|عن نطاق|out of scope|غير متاحة|مش متاحة|مش عندي|تفتقر|تقتصر";

/**
 * Refusals that already name their own gap. `gsc_queries` and the rival watch
 * answer like this by design («ينقصني: GSC_SITE_URL…»), so a second note from
 * here would say the same thing twice under the answer.
 */
const ALREADY_NAMED = /ينقصني|ينقصه|الناقص|يتفعّل بـ|التفعيل:/i;
const REFUSAL = new RegExp(`(?:${CAN_NOT})\\s*$`, "i");
const REFUSAL_ANYWHERE = new RegExp(CAN_NOT, "i");

export function isRefusal(text: string): boolean {
  if (!text) return false;
  if (REFUSAL.test(text.trim().slice(-120))) return true;
  return REFUSAL_ANYWHERE.test(text);
}

interface Rule {
  match: RegExp;
  capability: string;
  enablePath: string;
}

/**
 * Known gaps, by the words that usually ask for them. Each entry names the
 * missing capability and the shortest real path to it — the paths here are the
 * ones already implemented in this codebase, not aspirations.
 */
const RULES: Rule[] = [
  {
    match: /بحث|search|console|GSC|نقرة|ظهار في جوجل/i,
    capability: "Google Search Console — كلمات بحث حقيقية بدل التخمين",
    enablePath: "بيفتح من Google Cloud (مجاني): متغيرات GOOGLE_APPLICATION_CREDENTIALS_JSON وGSC_SITE_URL، والوسطي خمس دقايق.",
  },
  {
    match: /منافس|competitor|السوق|market/i,
    capability: "عيون على السوق — قياس المنافسين",
    enablePath: "بيتنزّل بسطر في جدول qayyim_rivals (اسم + رابط)، والقياس بيتم لوحده يوم الاثنين.",
  },
  {
    match: /نشر|انشر|اعتمد|publish|ارفع الموقع/i,
    capability: "موافقة بشرية قبل أي نشر",
    enablePath: "ده قرار دستوري مش عطل: الموافقة تتاخد من كارت الاقتراح في لوحة القرارات.",
  },
  {
    match: /مصنع|مصنّع|مخزن|مخزون|خامات|تصنيع|BOM/i,
    capability: "المصنع والمخزون",
    enablePath: "خارج إطلالة الموقع: دول في قسم التصنيع، وسرب القيّم ما بيقرأش الدفتر ده.",
  },
  {
    match: /توقع|تنبؤ|forecast|الشهر الجاي|الأسبوع الجاي/i,
    capability: "تاريخ بيع يكفي للتنبؤ",
    enablePath: "أول ست أيام بيع مسجلة في الدفتر تفتح الحساب؛ قبلها أي رقم يكون تكرار ليوم واحد.",
  },
  {
    match: /بريد|ايميل|SMS|رسايل نصية|واتس|whatsapp/i,
    capability: "إرسال برسالة أو مكالمة",
    enablePath: "محتاج خدمة مراسلة خارجية — دي الحاجة الوحيدة اللي بتاخد فلوس، والقاعدة صفر مدفوعات.",
  },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3);
}

/** Closest existing tool by word overlap — used so the note always points at
 * something real instead of leaving the owner with a dead end. */
function nearestTool(message: string, facts: GapFacts): { name: string; desc: string } | null {
  const words = new Set(tokenize(message));
  let best: { name: string; desc: string } | null = null;
  let bestScore = 0;
  for (const tool of facts.tools) {
    const score = tokenize(tool.desc).filter((w) => words.has(w)).length;
    if (score > bestScore) {
      best = tool;
      bestScore = score;
    }
  }
  return best ?? facts.tools[0] ?? null;
}

export function nameGap(message: string, facts: GapFacts): Gap | null {
  if (!message || !message.trim()) return null;
  const rule = RULES.find((r) => r.match.test(message));
  if (rule) return { capability: rule.capability, enablePath: rule.enablePath, nearestTool: nearestTool(message, facts)?.name ?? null };

  const subject = message.trim().replace(/\s+/g, " ").slice(0, 60);
  const near = nearestTool(message, facts);
  return {
    capability: `«${subject}» — مش موجود في عتاد السرب`,
    enablePath: `أقرب أداة موجودة: ${near ? `${near.name} (${near.desc})` : "ولا واحدة"} — لو الطلب ده لازم يتنفذ، يبقى يتضاف أداة بخطة مش يتنفذ نصه.`,
    nearestTool: near?.name ?? null,
  };
}

/**
 * The note itself, or "" when the reply did not refuse. Kept short and plain:
 * it sits under the answer, it does not replace it.
 */
export function explainGap(reply: string, message: string, facts: GapFacts): string {
  if (!isRefusal(reply) || ALREADY_NAMED.test(reply)) return "";
  const gap = nameGap(message, facts);
  if (!gap) return "";
  return `\n\nالناقص: ${gap.capability}\nيتفعّل بـ: ${gap.enablePath}`;
}
