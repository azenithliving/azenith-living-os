/**
 * Where the conversation reopens when he comes back to it.
 *
 * The panel stores, per employee, the moment he last reached the bottom of the thread. Coming back
 * means putting a «رسائل جديدة» line above the first thing the swarm said since then and landing
 * there — not dropping him at the newest message as if he had read everything in between.
 *
 * Two rules the inline version got from luck instead of intent: the search runs on the row's own
 * time rather than the door's array order, so a newest-first page cannot move the line down to the
 * newest unread and hide the ones above it; and the jump is only spent when the marker is actually
 * on screen, so a jump owed while the list is still loading is paid later instead of lost.
 */
export type ThreadMessage = {
  id: string;
  sender_type?: string | null;
  created_at?: string | null;
};

/** The stored stamp, or 0 for «this device has never read this thread». */
export function readStamp(raw: string | null | undefined): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** The earliest agent answer strictly after his stamp, or null when nothing waits for him. */
export function locateFirstUnread(rows: ThreadMessage[], lastReadMs: number): string | null {
  if (!lastReadMs) return null;
  let earliest: { id: string; at: number } | null = null;
  for (const row of rows) {
    if (row.sender_type !== "agent") continue;
    const at = row.created_at ? new Date(row.created_at).getTime() : NaN;
    if (!Number.isFinite(at) || at <= lastReadMs) continue;
    if (!earliest || at < earliest.at) earliest = { id: row.id, at };
  }
  return earliest?.id ?? null;
}

/**
 * Whether this pass pays the jump. `wait` keeps the debt: the marker is not on screen yet, so
 * scrolling to the bottom now would take him away from a line he has not been shown.
 */
export function unreadJump(state: {
  firstUnread: string | null;
  markerMounted: boolean;
  alreadyJumped: boolean;
}): "jump" | "wait" | "settled" | "none" {
  if (!state.firstUnread) return "none";
  if (state.alreadyJumped) return "settled";
  return state.markerMounted ? "jump" : "wait";
}
