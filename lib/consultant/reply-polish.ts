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
import { foldArabic } from "@/lib/arabic";
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

/** A greeting the advisor opens with, folded. */
const GREETING = /^(?:اهلا بك|اهلا وسهلا|اهلا|مساء النور|صباح الخير|مرحبا)/i;
/** A connector that only makes sense because something came before it. */
const CONNECTOR = /^(?:ولكن|لكن|ومع ذلك|مع ذلك|وعلي أي حال|وعلى أي حال|لذلك|وعليه)[,،:]?\s+/;

/**
 * Close the seam a cut leaves behind.
 *
 * Measured on the published store 2026-10-02: when the guard removed a sentence that sat inside
 * a numbered list, the customer read «… 3. 4. أساعدك في تنسيق الألوان» — an empty third item.
 * And because most denials rode in the sentence right after the greeting, every repair left a
 * reply that opened «أهلاً بك! ولكن، …» — the store's advisor starting a conversation with "but".
 *
 * Renumbering covers one- and two-digit markers only, so a sentence ending in a year keeps its
 * year, and it runs on every reply so a list the guard shortened reads as a list again.
 */
export function closeCutScars(reply: string): string {
  const withoutEmpty = String(reply ?? "")
    .replace(/(?:^|\s)\d{1,2}[.)](?=\s+\d{1,2}[.)])/g, " ")
    .replace(/^\s*\d{1,2}[.)]\s*$/gm, "");

  let text = withoutEmpty;
  // Renumber always: the guard may have taken a whole item, and a list that jumps from 2 to 4
  // shows the customer where a sentence used to be.
  let n = 0;
  text = text.replace(/(?<=^|\s)\d{1,2}([.)])(?=\s)/g, (_match, sep) => `${++n}${sep}`);

  const parts = text.split(/(?<=[.!؟?])\s+/);
  if (parts.length > 1 && GREETING.test(foldArabic(parts[0]))) {
    parts[1] = parts[1].replace(CONNECTOR, "");
    text = parts.join(" ");
  }

  return text.replace(CONNECTOR, "").replace(/[^\S\n]{2,}/g, " ").trim();
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
  polished = trimReply(closeCutScars(here.reply));
  if (!polished) {
    polished = language === "en"
      ? "I understand. Tell me which space you want to start with, and I will guide you step by step."
      : "فاهمك. قل لي تحب نبدأ بأي مساحة في البيت، وأنا أوضح لك أنسب خطوة بهدوء.";
  }

  return uiAction ? `${polished}\n[UI_ACTION: ${uiAction}]` : polished;
}
