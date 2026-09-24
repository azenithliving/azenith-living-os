/**
 * chat-brain.ts — the reasoning layer every admin chat reply passes through:
 *   1. recall: inject real semantic memories (pgvector, 768-dim) into context
 *   2. finalize: neutralize unverified links, derive clickable action buttons
 *
 * Deterministic and LLM-free except for the embedding call inside recall,
 * which already exists (SharedMemory → gemini-embedding-001).
 */

import { sharedMemory } from "./memory/SharedMemory";
import { verifyResponseLinks } from "./url-manifest";

export interface ChatBrainResult {
  reply: string;
  actions: string[];
  unverifiedLinks: string[];
}

/**
 * Pull up to 3 relevant past memories for the user's message.
 * Never throws — memory is an enhancement, not a dependency.
 */
export async function recallMemory(message: string, companyId: string | null): Promise<string> {
  if (!companyId) return "";
  try {
    await sharedMemory.initialize(companyId);
    const results = await sharedMemory.searchSimilar(message, { limit: 3, minSimilarity: 0.75 });
    if (!results?.length) return "";
    const lines = results
      .slice(0, 3)
      .map((r) => `- ${String(r.item.content).slice(0, 180)}`);
    return `[ذاكرتك عن موضوعات مشابهة:\n${lines.join("\n")}]`;
  } catch {
    return "";
  }
}

/**
 * Deterministically turn "اكتب لي X" / "قل X" / quoted-command bullets into
 * up to 3 button labels the UI already knows how to render
 * (ChatPanel reads metadata.suggestions / metadata.nextActions).
 */
export function deriveActions(text: string): string[] {
  const actions: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const label = raw.replace(/[.*_`]/g, "").replace(/^["'«»“”]+|["'«»“”]+$/g, "").trim();
    if (label.length >= 3 && label.length <= 80 && !seen.has(label)) {
      seen.add(label);
      actions.push(label);
    }
  };

  // "اكتب لي "أصلح وصف صوفا ملكية""  /  قل "اقترح صورة"  /  اضغط "وافق"
  for (const m of text.matchAll(/(?:اكتب لي|اكتب|قل|اضغط|أرسل|ابعت)\s*["'«»“”]([^"'«»“”]{3,80})["'«»“”]/g)) {
    push(m[1]);
  }

  // bullet lines that are themselves an imperative command: • "أنشئ مسودة للهيرو"
  for (const line of text.split("\n")) {
    const bullet = line.match(/^\s*[•\-]\s*["'«»“”]([^"'«»“”]{3,80})["'«»“”]/);
    if (bullet) push(bullet[1]);
  }

  return actions.slice(0, 3);
}

/**
 * One-stop finalizer for any reply shown to the admin.
 */
export function finalizeReply(rawReply: string, siteOrigin?: string): ChatBrainResult {
  const { text, removed } = verifyResponseLinks(rawReply, siteOrigin);
  let reply = text;
  if (removed.length) {
    reply += `\n\n⚠️ أزلت ${removed.length} رابط غير موجود في الموقع (${removed.slice(0, 2).join("، ")}${removed.length > 2 ? "…" : ""}) — كل رابط أعلاه يفحص مقابل خريطة المسارات الحقيقية.`;
  }
  return { reply, actions: deriveActions(rawReply), unverifiedLinks: removed };
}
