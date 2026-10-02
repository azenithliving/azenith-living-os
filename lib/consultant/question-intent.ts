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

/**
 * Asking to see the shop in person.
 *
 * Measured on the local build 2026-10-02, «ممكن أزور المعرض أشوف الركنة قبل ما أطلب؟» came back
 * as instructions for finding some other showroom's address on Google Maps — the store has no
 * showroom at all, the owner says so, and the advisor was sending a buyer to look for one.
 */
const SHOWROOM_VISIT =
  /(?:ازور|أزور|زيارة|عايز اشوف|عايز أشوف|ممكن اشوف|ممكن أشوف|معاينة|عنوان|فين)[^.!؟?\n]{0,20}(?:معرض|معرض|شوروم|showroom)|(?:معرض|شوروم|showroom)[^.!؟?\n]{0,20}(?:عندكم|بتاعكم|بتاعنا|الدار)|(?:عندكم|ليكم)[^.!؟?\n]{0,12}(?:معرض|شوروم)/i;

export function asksShowroomVisit(message: string): boolean {
  return SHOWROOM_VISIT.test(foldArabic(message));
}

/**
 * Asking what time the store is open — a recorded fact, not a chatbot's "always on".
 *
 * Spelled the way `foldArabic` leaves the customer's text (الساعه, امتي, النهارده), because a
 * pattern written in the unfolded shape never matches a folded message — the mistake that made
 * an earlier net here silent on «إمتى بتشتغلوا؟».
 */
const WORKING_HOURS =
  /(?:مواعيد\s+(?:العمل|الخدمه|الخدمتكم|الشغل)|الساعه\s+كام|من\s+الساعه\s+كام|امت[ىي]\s+(?:بتشتغلوا|شغالين|بتفتحوا|بتقفلوا)|بتفتحوا\s+الساعه|بتقفلوا\s+الساعه|فاتحين\s+(?:لسه|لحد|النهارده|اليوم)|شغالين\s+(?:الساعه|لسه|لحد|امت[ىي]|مت[ىي]))/i;

export function asksWorkingHours(message: string): boolean {
  return WORKING_HOURS.test(foldArabic(message));
}

/**
 * Asking where he is right now — the only question that needs the browser's location.
 */
const CURRENT_LOCATION_AR = anyWord("انا فين", "موقعي", "فين حاليا", "مكاني", "أنا فين");

const CURRENT_LOCATION_EN = /\b(?:current location|where am i|my location)\b/i;

export function asksCurrentLocation(message: string): boolean {
  const text = foldArabic(message);
  return CURRENT_LOCATION_AR.test(text) || CURRENT_LOCATION_EN.test(String(message ?? ""));
}

/**
 * The regions the store's own shipped voice already names as its own. Measured on the published
 * store 2026-10-02, the advisor answered «who executes and where do you deliver» as an outside
 * consultant — «most reputable contracting companies in this area» — and prompt facts did not
 * hold it, so these questions get the store's own recorded answer instead of a model's guess.
 */
const COVERAGE_AREAS = anyWord(
  "مصر",
  "التجمع",
  "القاهرة",
  "القاهرة الجديدة",
  "الرحاب",
  "مدينتي",
  "الشروق",
  "العاصمة الإدارية",
  "مدينة نصر",
  "مصر الجديدة",
  "المعادي",
  "الزمالك",
  "الجيزة",
  "أكتوبر",
  "الشيخ زايد",
  "الهرم",
  "فيصل",
  "الدقي",
  "المهندسين",
  "الساحل",
  "العلمين",
  "السخنة",
  "الغردقة",
  "الجونة",
  "شرم الشيخ",
  "الإسكندرية",
  "المنصورة",
  "طنطا",
  "المحلة",
  "الزقازيق",
  "دمياط",
  "بورسعيد",
  "الإسماعيلية",
  "السويس",
  "الفيوم",
  "بني سويف",
  "المنيا",
  "أسيوط",
  "سوهاج",
  "قنا",
  "الأقصر",
  "أسوان",
);

/** A verb of working or reaching, tied to a place or to "where", so «بتشتغلوا بالتقسيط» stays free. */
const COVERAGE_VERB =
  /(?:بتشتغلوا|بتوصلوا|بتغطوا|بتخدموا|شغالين|خدمتكم)|(?:فين)\s+(?:بتشتغلوا|بتوصلوا|شغالين)|مناطق\s+(?:الخدمه|الخدمة|الشغل|التوصيل)/i;

/** True when the customer is asking which places the store reaches. */
export function asksCoverage(message: string): boolean {
  const text = foldArabic(message);
  return COVERAGE_VERB.test(text) && COVERAGE_AREAS.test(text);
}

/** True when the customer is asking who actually does the work. */
export function asksExecution(message: string): boolean {
  const text = foldArabic(message);
  return anyWord(
    "مين اللي بينفذ",
    "مين بينفذ",
    "مين الصنايعية",
    "التنفيذ عندكم",
    "مين بيستلم الشغل",
    "مين بيشرف على الشغل",
  ).test(text);
}

/** An approximate price is still a price: the store does not quote numbers it has not recorded. */
const APPROX_PRICE_AR =
  /(?:تكلفه|تكاليف|سعر|اسعار)\s+(?:تقريبه|تقريبي|تقريبا|استرشاديه)|(?:كام|بكام)\s+تقريبا|تقدير\s+(?:التكلفه|السعر)/i;

export function asksApproximatePrice(message: string): boolean {
  return APPROX_PRICE_AR.test(foldArabic(message));
}
