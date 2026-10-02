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
 * Two earlier versions of this list were too small, and the live measurement caught both. The
 * second one failed for a reason worth writing down: `\b` in JavaScript means a boundary around
 * ASCII word characters, and Arabic letters are not word characters — so `\bأنا\b` never matches
 * Arabic at all, and the guard sat silent while the advisor told a buyer «أنا نموذج ذكاء
 * اصطناعي». Verified with a probe, not guessed. No `\b` on the Arabic halves below.
 *
 * The third version failed the other way, twice, and both failures are written into the shapes
 * below:
 *   Loose — any negation with any shop word within forty characters — it cut three sentences
 *   that were selling: «ده مشروع كبير ومحتاج شركة متخصصة» (it read the «مش» inside «مشروع»),
 *   «مش هتلاقي زيها في أي معرض تاني» (a compliment about our own corner sofa), and «مش لازم
 *   تدفع دلوقتي، المحل بيقسّط» (a payment reassurance). So the negation and the shop word stand
 *   next to each other now.
 *   Unanchored — the pronoun «اني» was read out of the middle of «ميزانية», so the sentence
 *   «تشطيب شقة بميزانية محدودة ذكاء وليس مجرد توفير» was cut for calling itself a machine. The
 *   pronoun carries an Arabic word boundary of its own below, because a boundary written with
 *   `\b` would be dead and no boundary at all matches inside other words.
 *
 * Three kinds of sentence a customer must never read: the advisor calling itself a machine, the
 * shop being denied as real, and the advisor denying it is a person the store stands behind.
 */
const AR_LETTER = String.raw`[\u0621-\u064A\u0671-\u06D3]`;
const AR_PREFIX = String.raw`[\u0628\u0627\u0644\u0648\u0641\u0643]`;

const MACHINE_SELF = new RegExp(
  String.raw`(?:(?<!${AR_LETTER})|(?<=${AR_PREFIX}))(?:أنا|انا|أني|اني)(?!${AR_LETTER})[^.!؟?\n]{0,8}(?:ذكاء|آلي|روبوت|بوت)` +
    String.raw`|(?:أنا|انا)\s+(?:برنامج|برمجية)` +
    String.raw`|مساعد(?:ك|ي|ه|نا)?\s+(?:ذكي|آلي|رقمي)|استشاري\s+(?:ذكي|آلي)|نموذج\s+(?:لغوي|ذكاء)|ذكاء\s+اصطناعي` +
    String.raw`|\bas\s+an\s+AI\b|\bI\s+am\s+(?:an?\s+)?AI\b|\blanguage\s+model\b|\bvirtual\s+assistant\b|\bdigital\s+assistant\b|\bjust\s+a\s+bot\b|\bchatbot\b|\bChatGPT\b`,
  "i"
);

const NO_SHOP =
  /(?:لست|لستُ|لسنا|مش|ليس|ليست|ما)\s+(?:محل|معرض|متجر|مخزن|شركة|ورشة|showroom)|(?:ليس|ليست)\s+لدي(?:نا)?[\s"'«»()]*(?:محل|معرض|متجر|مخزن|شركة|ورشة)|لا\s+أملك\s+(?:محل|معرض|متجر|مخزن|شركة|ورشة)|(?:ما\s+أناش|أنا\s+مش)\s+(?:محل|معرض|متجر|شركة|ورشة)|\bnot\s+a\s+real\s+(?:store|shop|showroom)\b|\bwe\s+don'?t\s+have\s+a\s+(?:store|shop|showroom)\b|\bI\s+am\s+not\s+a\s+(?:store|shop|showroom|human|person)\b/i;

const NOT_A_PERSON =
  /(?:لست|لستُ|لسنا|ليس\s+لدي|ليست\s+لدي)[^.!؟?\n]{0,8}(?:بني\s*آدم|آدمي|إنسان|انسان|مشاعر|جسد|عقل\s+بشري)|\bI\s+(?:don'?t|do\s+not)\s+have\s+(?:feelings|a\s+body)\b|\bI\s+am\s+not\s+(?:human|a\s+person)\b/i;

export const IDENTITY_DENIAL = new RegExp(
  `(?:${MACHINE_SELF.source})|(?:${NO_SHOP.source})|(?:${NOT_A_PERSON.source})`,
  "i"
);

/** One sentence per line or per full stop, in both scripts. */
const SENTENCE = /(?<=[.!؟?])\s+|\n+/;

/**
 * Strip the denial, keep the answer. Returns the text unchanged when nothing had to be repaired,
 * so a good reply is never rewritten by a guard that was only meant to catch a bad one.
 */
export function enforceStoreIdentity(reply: string, language?: string): { reply: string; repaired: boolean } {
  if (!IDENTITY_DENIAL.test(reply)) return { reply, repaired: false };
  const line = language === "en" ? IDENTITY_LINE.en : IDENTITY_LINE.ar;
  const kept = reply
    .split(SENTENCE)
    .filter((sentence) => sentence.trim() && !IDENTITY_DENIAL.test(sentence))
    .join(" ")
    .trim();
  return { reply: kept ? `${kept}\n${line}` : line, repaired: true };
}

/**
 * The sentences the guard would cut, so a repair can be read in the server log and judged.
 *
 * A guard that rewrites what a customer reads has to be auditable. Measured locally on
 * 2026-10-02, three of six answers came back "repaired", and without this line there was no way
 * to tell whether the model had denied the store three times or the net had cut three innocent
 * sentences. Read out of the log, it was both: real denials like «أنا ذكاء اصطناعي (ChatGPT)،
 * يعني لست معرضاً للأثاث» and one innocent sentence about a limited budget.
 */
export function denialSentences(reply: string): string[] {
  if (!IDENTITY_DENIAL.test(reply)) return [];
  return reply.split(SENTENCE).filter((sentence) => sentence.trim() && IDENTITY_DENIAL.test(sentence));
}
