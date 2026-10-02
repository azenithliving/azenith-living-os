/**
 * identity-voice.ts — the sentence the store's advisor is allowed to say about itself.
 *
 * Measured on the published site 2026-10-02: asked about a modern corner sofa, the consultant
 * answered a customer, on the store's own page, that it was an artificial intelligence and not a
 * real furniture shop. A page denying that the store behind it is real is not a tone problem —
 * it is a sale ended in one sentence, and the reason the store exists.
 *
 * The prompt asks for the same thing; this file is the control. An instruction is a wish.
 */

/** What the advisor says about itself when a denial has to be replaced. */
export const IDENTITY_LINE = {
  ar: "أنا مساعد أزينث ليفينج، وفريق المتجر هو اللي بينفّذ المشروع.",
  en: "I am the Azenith Living advisor, and the store's own team executes the project.",
};

/**
 * Every denial this store has actually produced in front of a customer, plus its obvious kin.
 *
 * The first version of this list was too small and the measurement caught it: after the guard
 * shipped, the advisor told a buyer that it was a smart AI assistant, not a real furniture
 * showroom, and that it had no shop or warehouse — three denials, none of them in the pattern,
 * and my counter reported zero. A checker that misses the thing it checks is worse than no
 * checker: it reports green. So the rule is two-part now — the assistant calling itself a
 * machine, and the shop being denied as real — since either half alone is a sentence no
 * customer should read.
 */
const AI_SELF =
  /(?:\b(?:أنا|انا|I am|I'm)\b[^.!؟?\n]{0,30}\b(?:ذكاء|ذكي|آلي|الي|برمج|برامج|روبوت|بوت|نموذج|chat\s*bot|chatbot|AI)\b)|(?:مساعد|استشاري)\s+(?:ذكي|آلي)|نموذج\s+لغوي|as\s+an\s+ai|language\s+model|virtual\s+assistant|just\s+a\s+bot/i;

const NOT_A_REAL_SHOP =
  /(?:لست|لستُ|لسنا|ليس\s+لدي|ليست\s+لدي|لا\s+أملك|مش|مو\s+عندنا)[^.!؟?\n]{0,40}(?:محل|معرض|متجر|مخزن|شركة|ورشة|showroom)|not\s+a\s+real\s+(?:store|shop|showroom)|we\s+don'?t\s+have\s+a\s+(?:store|shop|showroom)/i;

export const IDENTITY_DENIAL = new RegExp(`${AI_SELF.source}|${NOT_A_REAL_SHOP.source}`, "i");

/**
 * Strip the denial, keep the answer. Returns the text unchanged when nothing had to be repaired,
 * so a good reply is never rewritten by a guard that was only meant to catch a bad one.
 */
export function enforceStoreIdentity(reply: string, language?: string): { reply: string; repaired: boolean } {
  if (!IDENTITY_DENIAL.test(reply)) return { reply, repaired: false };
  const line = language === "en" ? IDENTITY_LINE.en : IDENTITY_LINE.ar;
  const kept = reply
    .split(/(?<=[.!؟?])\s+/)
    .filter((sentence) => sentence.trim() && !IDENTITY_DENIAL.test(sentence))
    .join(" ")
    .trim();
  return { reply: kept ? `${kept}\n${line}` : line, repaired: true };
}
