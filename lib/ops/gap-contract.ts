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
  "(?:مش|ما)\\s?(?:ه|ب)?أ?ق[ا]?در|م[ا]?\\s?ق[ا]?درش|لا\\s?أ?ستطيع|لا\\s?أ?قدر|عجزت|خارج نطاق|عن نطاق|out of scope|غير متاحة|مش متاحة|مش عندي|تفتقر|تقتصر";

/**
 * Refusals that already name their own gap. `gsc_queries` and the rival watch
 * answer like this by design («ينقصني: GSC_SITE_URL…»), so a second note from
 * here would say the same thing twice under the answer.
 */
const ALREADY_NAMED = /ينقصني|ينقصه|الناقص|يتفعّل بـ|التفعيل:|خارج إطلالة/i;
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
 *
 * The Arabic is deliberately clean of inline Latin: the reader is the shop's
 * owner, and a Latin token or a bracket inside an Arabic sentence flips the
 * rendering of the whole line. Variable and table names still appear — they are
 * what he has to type — but each on a line of its own.
 */
const RULES: Rule[] = [
  {
    match: /بحث|search|console|GSC|نقرة|ظهار في جوجل/i,
    capability: "كلمات بحث حقيقية من جوجل بدل التخمين",
    enablePath:
      "بتتفعّل من منصة جوجل للمطورين، وهي مجانية وبتاخد خمس دقايق. المتغيرات المطلوبة:\nGOOGLE_APPLICATION_CREDENTIALS_JSON\nGSC_SITE_URL",
  },
  {
    match: /منافس|competitor|السوق|market/i,
    capability: "عيون على السوق — قياس المنافسين",
    enablePath: "بيتنزّل بسطر لكل منافس: اسمه ورابطه. الدفتر المطلوب:\nqayyim_rivals\nوالقياس بيتم لوحده يوم الاثنين.",
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
    enablePath: near
      ? `أقرب أداة موجودة عندنا اسمها:\n${near.name}\nوهي بتعمل: ${near.desc}\nلو الطلب ده لازم يتنفذ، يبقى يتضاف أداة بخطة — مش يتنفذ نصه.`
      : "مفيش أداة قريبة من الطلب ده أصلاً. لو لازم يتنفذ، يبقى يتضاف أداة بخطة.",
    nearestTool: near?.name ?? null,
  };
}

/**
 * The note itself, or "" when the reply did not refuse. Kept short and plain:
 * it sits under the answer, it does not replace it.
 */
/**
 * Claims of having switched on, or already sent, an outbound channel.
 *
 * Caught live on production: asked to «ابعت SMS لكل عميل قديم», the content agent
 * answered «[إشعار] تنبيهات الطلبات — مفعّلة الآن» with a table of actions. No
 * tool in this swarm sends anything to anyone, so that sentence is not a
 * misunderstanding to be tolerated — it is the shop telling its owner a thing
 * happened that cannot have happened. A refusal is recoverable; a confident lie
 * gets budget approved.
 */
const OUTBOUND =
  /SMS|(?:رسائل|رسالة)\s?الإ?نص[ي]?ة|مكالمة|اتصال\s?(?:بيه|بيا|بينه|عليه)|بريد\s?الإ?لكتروني|واتس|whatsapp|email|call/i;
const CLAIMS_DONE =
  /مفعّلة الآن|مفعّله الآن|تم\s?تفعيل|التفعيل\s?تمام|بنرسل|هبنرسل|بعتلها|بعتله|وصلتهم|أرسلت|تم\s?الإ?رسال|يتم\s?الإ?رسال/i;

/** The correction, appended when a reply claims an outbound act the swarm cannot
 * perform. Kept factual and short: it says what does not exist, not what the
 * model did wrong. */
function outboundCorrection(message: string, facts: GapFacts): string {
  const gap = nameGap(message, facts) ?? {
    capability: "إرسال للخارج (رسالة نصية أو مكالمة أو بريد)",
    enablePath: "محتاج خدمة مراسلة خارجية — دي الحاجة الوحيدة اللي بتاخد فلوس، والقاعدة صفر مدفوعات.",
  };
  return (
    "\n\n⚠️ تصحيح: مفيش في عتاد السرب أداة بعت أو اتصال. اللي فوق ده ما حصلش." +
    `\nالناقص: ${gap.capability}\nيتفعّل بـ: ${gap.enablePath}`
  );
}

export function explainGap(
  reply: string,
  message: string,
  facts: GapFacts,
  opts: { executed?: boolean } = {},
): string {
  if (!reply) return "";

  // The claim is checked first: a reply that both boasts and hedges would
  // otherwise get only the softer refusal note. Skipped when a tool actually
  // ran — `lead_dossier_send` saying «تم الإرسال» is a report, not a fabrication,
  // and correcting it would tell the owner the opposite of the truth.
  // The outbound cue may live in the question instead of the answer: asked
  // «ابعت SMS», a reply of «تنبيهات الطلبات — مفعّلة الآن» never repeats the word
  // SMS and used to slip through on that technicality. A done-verb plus an
  // outside channel in either half of the exchange is the same lie.
  const claimsOutbound = (OUTBOUND.test(reply) || OUTBOUND.test(message)) && CLAIMS_DONE.test(reply);
  if (!opts.executed && claimsOutbound) return outboundCorrection(message, facts);

  if (!isRefusal(reply) || ALREADY_NAMED.test(reply)) return "";
  const gap = nameGap(message, facts);
  if (!gap) return "";
  return `\n\nالناقص: ${gap.capability}\nيتفعّل بـ: ${gap.enablePath}`;
}
