/**
 * customer-voice.ts — how the advisor's answer looks and sounds on the customer's phone.
 *
 * Two defects, both measured on the published store 2026-10-02:
 *
 * ١. The chat bubble prints plain text, so the model's markdown arrives as symbols in the
 *    customer's face: «يمكنني مساعدتك جداً في **اختيار الركنة المودرن المناسبة** … ### 1. أحدث
 *    صيحات الركنة المودرن». Two of six real questions came back that way.
 *
 * ٢. Asked about a corner sofa and about which districts the store covers, the advisor
 *    answered as a guide to the trade and sent the customer away: «وأقول لك على أماكن مشهورة
 *    في مصر تقدر تشتري منها», «فإذا كانت أي شركة تعمل في القاهرة الجديدة». A page handing its
 *    buyer to other shops is the same loss as a page denying the store exists — so the sentence
 *    that gives the sale away is removed and the useful part stays, exactly as the identity
 *    guard does.
 */

/**
 * A sentence that points the customer at somebody else's shop.
 *
 * Written from the live replies, not from imagination: «يمكنني أن أقترح عليك أسماء معارض
 * مشهورة أو مواقع إلكترونية موثوقة تبيع أثاث مودرن», «أيكيا: للموديلات المودرن جداً»,
 * «أين يمكنك البحث؟ (في مصر كمثال)», «يفضل تتواصل معهم عبر صفحتهم الرسمية».
 */
export const AWAY_REFERRAL =
  /(أماكن|محلات|معارض|معرض|شركات|شركة|ورش|ورشة|مناطق|مخازن|متاجر|مواقع)\s+(مشهورة|مشهور|معروفة|معروف|تانية|أخرى|كتير|كثيرة|موثوقة|موثوق)|اشتر[يى]\s+من\s+(أي|أى)\s+(محل|شركة|مكان|ورشة|معرض)|من\s+أي\s+(محل|شركة|مكان|ورشة|معرض)|أي\s+شركة\s+(تعمل|بتعمل|بتشتغل|تقدر|في)|أي\s+(محل|شركة|ورشة)\s+(تاني|آخر)|أين\s+(?:يمكنك|تقدر)\s+(?:البحث|تبحث|تدور|تشتر)|مواقع\s+(?:إلكترونية|الكترونية)|صفحتهم\s+الرسمية|ايكيا|إيكيا|IKEA|هوم\s*سنتر|إن\s*آند\s*أوت|هب\s*فرنيتشر|معارض\s+دمياط|other\s+(?:shops?|stores?|showrooms?|companies)|(?:buy|order)\s+from\s+(?:any|other|another)|showrooms?\s+(?:in|near|around)\s+(?:Egypt|Cairo)|market\s+(?:places?|sellers)/i;

/** What replaces a reply that was only a referral to somebody else. */
export const HERE_LINE = {
  ar: "اللي أقدر أقوله لك عليه هو شغلنا احنا في أزينث: قول لي المساحة والستايل، وأمشي معاك خطوة خطوة.",
  en: "What I can speak for is our own work at Azenith: tell me the space and the style, and I will walk you through it step by step.",
};

/**
 * Remove the sentence that sends the customer to another shop, keep the rest of the answer.
 * Returns the text untouched when nothing had to be repaired.
 */
export function enforceNoReferralAway(reply: string, language?: string): { reply: string; repaired: boolean } {
  if (!AWAY_REFERRAL.test(reply)) return { reply, repaired: false };
  const line = language === "en" ? HERE_LINE.en : HERE_LINE.ar;
  const kept = reply
    .split(/(?<=[.!؟?])\s+|\n+/)
    .filter((sentence) => sentence.trim() && !AWAY_REFERRAL.test(sentence))
    .join("\n")
    .trim();
  return { reply: kept ? `${kept}\n${line}` : line, repaired: true };
}

/** The sentences the referral guard would cut, so a repair can be audited in the server log. */
export function referralSentences(reply: string): string[] {
  if (!AWAY_REFERRAL.test(reply)) return [];
  return reply
    .split(/(?<=[.!؟?])\s+|\n+/)
    .filter((sentence) => sentence.trim() && AWAY_REFERRAL.test(sentence));
}

/**
 * Drop a parenthesised Latin gloss from an Arabic line.
 *
 * Measured on the published store 2026-10-03: three of six answers carried «الركنة «المنفوخة»
 * (Cloud Sofa)» and «أحدث الصيحات (Trends)». On a phone reading right-to-left, a Latin run in
 * the middle of an Arabic sentence scrambles the line for the customer, and the gloss is never
 * the reason he asked — the Arabic word next to it already says it.
 *
 * Only brackets holding Latin go. A bracketed measurement («٩٠ سم»), an Arabic phrase, or a
 * whole-English reply keeps everything it had.
 */
export function dropLatinGlosses(reply: string): string {
  const text = String(reply ?? "");
  if (!/\p{Script=Arabic}/u.test(text)) return text;
  return text
    .replace(/\(([^()]*)\)/g, (whole, inner: string) => (/\p{Script=Latin}/u.test(inner) ? "" : whole))
    .replace(/[“"”]\s*[“"”]/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,!?؟،:])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .trim();
}

/**
 * Take the markdown out of a reply that will be printed as plain text in a chat bubble.
 *
 * Headings lose their hashes, a bullet becomes a dot, bold and italics keep their words and
 * lose their asterisks, a link keeps its label. Nothing is invented and no sentence is
 * dropped — this is the one guard here that only changes punctuation.
 */
export function plainCustomerReply(reply: string): string {
  const text = String(reply ?? "");
  return dropLatinGlosses(
    text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/`/g, ""))
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s{0,3}[-*_]{3,}\s*$/gm, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    // The model writes its headings mid-sentence too, so a hash run after a space goes as well.
    .replace(/(?<=\s)#{1,6}\s*/g, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    // The same bullet written mid-line, because the model runs its list items together.
    // This runs before the emphasis rules, or two bullet marks read as one italic pair.
    .replace(/(?:^|(?<=\s))[*+]\s+/g, "• ")
    .replace(/\[([^\]]*)\]\(([^)\s]*)\)/g, "$1")
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2")
    .replace(/(\*|_)(?=\S)([^*_\n]*?\S)\1/g, "$2")
    .replace(/(?:^|(?<=\s))[*_](?=\s|$)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  );
}
