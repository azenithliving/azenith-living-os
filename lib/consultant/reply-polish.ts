/**
 * reply-polish.ts — the last hands on a reply before a customer reads it.
 *
 * Three things happen here, in this order: the hidden UI action is lifted out, the markdown is
 * taken out (the chat bubble prints plain text), and the two store-voice guards remove any
 * sentence that denies the store or sends the customer to another shop. Then the answer is cut
 * to two paragraphs and, if nothing survived, replaced by one honest line that asks the next
 * question.
 *
 * It lives outside the route so a test can push a real live reply through the real pipeline
 * instead of through a copy of it.
 */
import { denialSentences, enforceStoreIdentity } from "@/lib/consultant/identity-voice";
import { enforceNoReferralAway, plainCustomerReply, referralSentences } from "@/lib/consultant/customer-voice";
export function extractUiAction(reply: string): { cleanReply: string; uiAction?: string } {
  const match = reply.match(/\[UI_ACTION:\s*([^\]]+)\]/);
  const cleanReply = reply.replace(/\[UI_ACTION:\s*[^\]]+\]/g, "").trim();
  return { cleanReply, uiAction: match?.[1]?.trim() };
}

export function trimReply(reply: string): string {
  const paragraphs = reply
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length <= 2) {
    return reply.trim();
  }

  return paragraphs.slice(0, 2).join("\n\n").trim();
}

export function polishReply(reply: string, language?: string): string {
  const { cleanReply, uiAction } = extractUiAction(reply);
  let polished = cleanReply
    .replace(/\bindeed\b/gi, "")
    .replace(/\bactually\b/gi, "")
    .replace(/\bperfect\b/gi, language === "en" ? "Excellent" : "ممتاز")
    .replace(/[^\S\n]{2,}/g, " ")
    .trim();

  // The bubble prints plain text, so markdown would reach the customer as stray punctuation.
  polished = plainCustomerReply(polished);

  const voice = enforceStoreIdentity(polished, language);
  if (voice.repaired) {
    console.warn(
      "[Consultant] identity repaired — the sentence that was cut:",
      denialSentences(polished).map((sentence) => sentence.slice(0, 160))
    );
  }
  const here = enforceNoReferralAway(voice.reply, language);
  if (here.repaired) {
    console.warn(
      "[Consultant] referral repaired — the sentence that was cut:",
      referralSentences(voice.reply).map((sentence) => sentence.slice(0, 160))
    );
  }
  polished = trimReply(here.reply);
  if (!polished) {
    polished = language === "en"
      ? "I understand. Tell me which space you want to start with, and I will guide you step by step."
      : "فاهمك. قل لي تحب نبدأ بأي مساحة في البيت، وأنا أوضح لك أنسب خطوة بهدوء.";
  }

  return uiAction ? `${polished}\n[UI_ACTION: ${uiAction}]` : polished;
}
