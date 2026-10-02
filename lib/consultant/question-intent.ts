/**
 * question-intent.ts — the only questions a canned answer may take away from the advisor.
 *
 * Measured on the published store 2026-10-02 with six real shopper questions: three never
 * reached a model. «أنسب لشقة ١٨٠ متر» was read as a price question because the net held the
 * bare word «متر», «الفرق بين الخشب الجيد والوحش» was read as an insult needing management
 * because the net held the bare word «وحش», and «من أول ما أكلمكم» was read as a food order
 * because «أكلمكم» contains «أكل» — so a customer asking how the work is done was told to
 * switch on location permission. A guard that answers in the store's place is worse than no
 * guard: it is instant, fluent, and wrong, and the customer never learns his question was
 * swallowed.
 *
 * So each net is written as the thing it is meant to catch — a money ask, a complaint aimed at
 * us, a request for a person — and every message is folded before it is read, so one spelling
 * of a word is enough. Word shapes come from `arabicWord`: a bare `\b` never matches Arabic,
 * and no boundary at all matches inside a longer word.
 */
import { foldArabic, arabicWord } from "@/lib/arabic";

/** Fold a word list into one Arabic-safe alternation, matched against folded messages. */
function anyWord(...words: string[]): RegExp {
  return new RegExp(words.map((word) => arabicWord(foldArabic(word))).join("|"), "i");
}

/** Naming money, or asking how many pounds — never a measurement on its own. */
const PRICE_ASK_AR = anyWord(
  "بكام",
  "سعر",
  "أسعار",
  "تسعير",
  "تكلفة",
  "ثمن",
  "عرض سعر",
  "قائمة أسعار",
  "فاتورة",
);

/** «كام» on its own means "how many", so it only counts next to a money word. */
const PRICE_AMOUNT_AR = /(?:كام|بكام)\s*(?:جنيه|جنيها|جنيهات|ألف|الف|فلوس|قرش)/i;

const PRICE_ASK_EN = /\b(?:price|prices|pricing|cost|costs|quote|quotation|how much|price list|per meter)\b/i;

/**
 * True when the customer is asking what something costs.
 *
 * Deliberately not netted: the bare «متر» (every furniture message carries a measurement) and
 * a stated budget («ميزانيتي محدودة، أبدأ بإيه؟») — that is a customer asking for advice, and
 * the advisor is already forbidden from inventing a number.
 */
export function asksPrice(message: string): boolean {
  const text = foldArabic(message);
  return PRICE_ASK_AR.test(text) || PRICE_AMOUNT_AR.test(text) || PRICE_ASK_EN.test(String(message ?? ""));
}

/** Asking for the owner, a manager, or a real employee. */
const PERSON_AR = anyWord(
  "صاحب الشركة",
  "صاحب المحل",
  "المدير",
  "الإدارة",
  "مسئول",
  "مسؤول",
  "موظف حقيقي",
  "حد من الشركة",
);

/** A customer who cannot follow the answer deserves a person, not another paragraph. */
const CONFUSION_AR = anyWord("مش فاهم", "مش فاهمة", "ما فهمتش", "مش واضح");

/**
 * A complaint aimed at us. The adjective alone is not enough: «الفرق بين الخشب الجيد والوحش»
 * is a customer learning to choose wood, and the same word netted on its own sent him to
 * management instead of to an answer.
 */
const DIRECTED_COMPLAINT_AR =
  /(?:انت|انتم|حضرتك|الرد|ردك|ردكم|كلامك|كلامكم|خدمتكم|الخدمه|التعامل|الشغل|الشغاله|الموظف|البوت|البرنامج)(?:\s+\S+){0,2}\s*(?:وحش|وحشه|زفت|سيء|سيئ|غبي|بايظ|فاشل|مضلل|كذاب)|(?:وحش|زفت|سيء|سيئ|غبي|بايظ)(?:\s+\S+){0,2}\s*(?:انت|انتم)/i;

const ESCALATION_EN = /\b(?:owner|manager|management|supervisor|human agent|speak to a human|talk to a human)\b/i;

/** True when the customer wants a person, or is complaining about us rather than about wood. */
export function asksEscalation(message: string): boolean {
  const text = foldArabic(message);
  return (
    PERSON_AR.test(text) ||
    CONFUSION_AR.test(text) ||
    DIRECTED_COMPLAINT_AR.test(text) ||
    ESCALATION_EN.test(String(message ?? ""))
  );
}

/**
 * Naming a restaurant or a meal, as whole words.
 *
 * «غدا» stays out: it is also "tomorrow", and a customer writing «غدا هاجي المعرض» does not
 * want a restaurant list. Losing that one hospitality path costs less than answering him with
 * a demand for his location.
 */
const FOOD_AR = anyWord(
  "اكل",
  "مطعم",
  "مطاعم",
  "كافيه",
  "قهوة",
  "غداء",
  "عشا",
  "عشاء",
  "فطار",
  "فطور",
  "بيتزا",
  "برجر",
  "سوشي",
);

const FOOD_EN = /\b(?:restaurant|restaurants|cafe|coffee|food|eat|dinner|lunch|breakfast)\b/i;

/** True when the customer is asking where to eat, not how to furnish a room. */
export function asksFoodNearby(message: string): boolean {
  const text = foldArabic(message);
  return FOOD_AR.test(text) || FOOD_EN.test(String(message ?? ""));
}

/** Asking where he is right now — the only question that needs the browser's location. */
const CURRENT_LOCATION_AR = anyWord("انا فين", "موقعي", "فين حاليا", "مكاني", "أنا فين");

const CURRENT_LOCATION_EN = /\b(?:current location|where am i|my location)\b/i;

export function asksCurrentLocation(message: string): boolean {
  const text = foldArabic(message);
  return CURRENT_LOCATION_AR.test(text) || CURRENT_LOCATION_EN.test(String(message ?? ""));
}
