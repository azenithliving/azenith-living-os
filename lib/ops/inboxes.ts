import { legacyToOps } from "./identity";
import { previewLine } from "./command-canvas";

/**
 * inboxes.ts — every unread badge on the owner's cockpit, answered from one read.
 *
 * The cockpit used to ask for each employee's inbox separately: nine doors, each behind a function
 * that may be cold, and the screen sat on «بستنى رد السيرفر…» until the slowest one answered. This
 * module is the same question asked once: given the conversations and the messages the door already
 * fetched, what does each employee's card show.
 *
 * The resolution rule is copied from the messages door on purpose — a participant match or a title
 * that carries the key, newest conversation wins. Two rules for one question is how a badge and
 * the chat behind it start disagreeing.
 */

export type ConversationRow = {
  id: string;
  title?: string | null;
  participants?: string[] | null;
  created_at?: string | null;
};

export type MessageRow = {
  conversation_id: string;
  sender_type?: string | null;
  content?: string | null;
  created_at?: string | null;
};

export type InboxAnswer = { unread: number; teaser: string | null; exact: boolean };

/** How many unread rows the door is willing to count off a page before it asks for a number. */
const PAGE_CAP = 1000;

/** The newest conversation an employee owns, by the messages door's own rule. */
export function conversationFor(key: string, conversations: ConversationRow[]): ConversationRow | null {
  const live = legacyToOps(String(key ?? "").trim().toLowerCase());
  if (!live) return null;
  const owned = conversations.filter(
    (row) => Array.isArray(row.participants) && row.participants.includes(live)
  );
  const titled = conversations.filter((row) => String(row.title ?? "").includes(live));
  const candidates = [...new Set([...owned, ...titled])];
  if (!candidates.length) return null;
  return candidates.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] ?? null;
}

/**
 * The card answer for each key asked for.
 *
 * A key with no conversation is zero and no teaser — an employee who was never written to is not
 * an error, and the card must not look broken because of it. When the unread page came back full,
 * the count comes from the record's own number instead of the page's length, because a badge that
 * saturates is a badge the owner stops trusting.
 */
export function buildInboxes(input: {
  keys: string[];
  conversations: ConversationRow[];
  unreadRows: MessageRow[];
  lastRows: MessageRow[];
  saturated: boolean;
  exactCounts?: Record<string, number> | null;
}): Record<string, InboxAnswer> {
  const unreadByConversation = new Map<string, number>();
  for (const row of input.unreadRows ?? []) {
    unreadByConversation.set(row.conversation_id, (unreadByConversation.get(row.conversation_id) ?? 0) + 1);
  }

  // The rows arrive newest-first, so the first one seen per conversation is its last word.
  const teaserByConversation = new Map<string, string | null>();
  for (const row of input.lastRows ?? []) {
    if (teaserByConversation.has(row.conversation_id)) continue;
    teaserByConversation.set(row.conversation_id, previewLine(String(row.content ?? "")) || null);
  }

  const boxes: Record<string, InboxAnswer> = {};
  for (const asked of input.keys ?? []) {
    const key = legacyToOps(String(asked ?? "").trim().toLowerCase());
    if (!key || boxes[key]) continue;
    const conversation = conversationFor(key, input.conversations ?? []);
    if (!conversation) {
      boxes[key] = { unread: 0, teaser: null, exact: true };
      continue;
    }
    const counted = unreadByConversation.get(conversation.id) ?? 0;
    const exact = input.exactCounts?.[conversation.id];
    const saturated = input.saturated && counted >= PAGE_CAP;
    boxes[key] = {
      unread: saturated && typeof exact === "number" ? exact : counted,
      teaser: teaserByConversation.get(conversation.id) ?? null,
      // A saturated page with no number behind it is an approximation, and the screen is allowed
      // to say so rather than present it as measured.
      exact: !saturated || typeof exact === "number",
    };
  }
  return boxes;
}
