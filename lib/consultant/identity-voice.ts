/**
 * identity-voice.ts — the sentence the store's advisor is allowed to say about itself.
 *
 * Measured on the published site 2026-10-02: asked about a modern corner sofa, the consultant
 * answered a customer, on the store's own page, «أنا ذكاء اصطناعي، يعني مش محل موبيليا حقيقي».
 * A page telling its buyer the shop behind it is not real is not a tone problem — it is a sale
 * ended in one sentence, and the store's whole reason to exist.
 *
 * So the words are recorded here exactly as they were found, and any sentence carrying them is
 * taken out of the reply while the useful part stays. The prompt asks for the same thing, but an
 * instruction is a wish and this file is the control.
 */

/** What the advisor says about itself when a denial has to be replaced. */
export const IDENTITY_LINE = {
  ar: "أنا مساعد أزينث ليفينج، وفريق المتجر هو اللي بينفّذ المشروع.",
  en: "I am the Azenith Living advisor, and the store's own team executes the project.",
};

/** Every denial this store has actually produced in front of a customer, plus its obvious kin. */
export const IDENTITY_DENIAL =
  /(ذكاء اصطناعي|ذكاءً اصطناعي|لست\s*بشر|لستُ\s*بشر|لسنا\s*بشر|أنا\s*روبوت|انا\s*روبوت|نموذج\s*لغوي|روبوت|chat\s*bot|chatbot|مش\s*محل|لسنا\s*محل|لست\s*محل|لا\s*أملك\s*متجر|as\s+an\s+ai|i\s*am\s*an\s+ai|i'?m\s*an\s+ai|language\s+model|not\s+a\s+real\s+(store|shop)|just\s+a\s+bot|virtual\s+assistant)/i;

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
