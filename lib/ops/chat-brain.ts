/**
 * chat-brain.ts — the reasoning layer every admin chat reply passes through:
 *   1. recall: inject real semantic memories (pgvector, 768-dim) into context
 *   2. finalize: retire any name the model resurrects, neutralize unverified
 *      links, derive clickable action buttons
 *
 * Deterministic and LLM-free except for the embedding call inside recall,
 * which already exists (SharedMemory → gemini-embedding-001).
 */

import { sharedMemory } from "./memory/SharedMemory";
import { verifyResponseLinks } from "./url-manifest";
import { scrubRetiredProductName, SWARM_NAME } from "./identity";

export interface ChatBrainResult {
  reply: string;
  actions: string[];
  unverifiedLinks: string[];
}

/** What came back from the swarm's memory, and how — so the surface can say which answered. */
export interface MemoryRecall {
  block: string;
  count: number;
  how: "vector" | "keyword" | "none";
  failure: string | null;
}

const EMPTY_RECALL: MemoryRecall = { block: "", count: 0, how: "none", failure: null };

/**
 * Pull up to 3 relevant past memories for the owner's question.
 *
 * Semantic first, then the keyword floor: measured 2026-10-15, this recall ran on every reply and
 * returned nothing at all — 0 rows in the table, and a query vector that needs a model key. A store
 * whose memory depends on a key has no memory, so the same rows are now read by their own Arabic
 * words when no vector answers. Never throws: memory is an enhancement, not a dependency — but a
 * refusal is named in the log instead of swallowed, because silence is what made this organ look
 * healthy for a month.
 */
export async function recallMemory(message: string, companyId: string | null): Promise<MemoryRecall> {
  if (!companyId) return EMPTY_RECALL;
  try {
    await sharedMemory.initialize(companyId);

    const vector = await sharedMemory
      .searchSimilar(message, { limit: 3, minSimilarity: 0.75 })
      .catch((err: unknown) => {
        console.warn(`[ChatBrain] الذاكرة الدلالية ما ردتش: ${err instanceof Error ? err.message.slice(0, 160) : String(err)}`);
        return null;
      });
    if (vector?.length) {
      const lines = vector.slice(0, 3).map((r) => `- ${String(r.item.content).slice(0, 180)}`);
      return {
        block: `[ذاكرتك عن موضوعات مشابهة — من سجل الموظفين، بالبحث الدلالي:\n${lines.join("\n")}]`,
        count: vector.length,
        how: "vector",
        failure: null,
      };
    }

    const text = await sharedMemory.recallText(message, { limit: 3 });
    if (text.failure) console.warn(`[ChatBrain] ${text.failure}`);
    if (!text.items.length) return { ...EMPTY_RECALL, failure: text.failure };

    const lines = text.items.map((item) => `- ${String(item.content).slice(0, 180)}`);
    return {
      block: `[ذاكرة الدار بالكلمة — من سجل الموظفين، من غير مفتاح نموذج:\n${lines.join("\n")}]`,
      count: text.items.length,
      how: "keyword",
      failure: text.failure,
    };
  } catch (err) {
    const failure = `الذاكرة ما اتقريتش: ${err instanceof Error ? err.message.slice(0, 160) : String(err)}`;
    console.warn(`[ChatBrain] ${failure}`);
    return { ...EMPTY_RECALL, failure };
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
 *
 * `selfLabel` is who the answering member calls itself; the retired product name a
 * model may still write gets replaced by it. Every caller knows its agent, and the
 * default exists only so a surface that forgets cannot publish the dead name.
 */
export function finalizeReply(
  rawReply: string,
  siteOrigin?: string,
  selfLabel: string = SWARM_NAME,
): ChatBrainResult {
  const scrubbed = scrubRetiredProductName(rawReply, selfLabel);
  const { text, removed } = verifyResponseLinks(scrubbed, siteOrigin);
  let reply = text;
  if (removed.length) {
    reply += `\n\n⚠️ أزلت ${removed.length} رابط غير موجود في الموقع (${removed.slice(0, 2).join("، ")}${removed.length > 2 ? "…" : ""}) — كل رابط أعلاه يفحص مقابل خريطة المسارات الحقيقية.`;
  }
  return { reply, actions: deriveActions(scrubbed), unverifiedLinks: removed };
}
