/**
 * The cold clock — the first capability the sales office gained after it moved.
 *
 * A customer who asked and was not answered is losing money by the hour, and the
 * screen used to show every lead with the same silence whether they wrote a minute
 * ago or a month ago.
 *
 * The brake that shapes this file is the owner's rule against invented numbers: a
 * lead with no date anywhere reads as `unknown`, never as zero hours. Zero would
 * print «حار» on a dead customer, and a machine that guesses looks exactly like a
 * machine that works.
 */
export type FreshnessKey = "hot" | "warm" | "cold" | "lost" | "unknown";

export const FRESHNESS_LABELS: Record<FreshnessKey, string> = {
  hot: "حار",
  warm: "دافئ",
  cold: "بارد",
  lost: "بيضيع",
  unknown: "بدون تاريخ",
};

/** How urgent each state is, for sorting the waiting list. Unknown never outranks a real reading. */
export const FRESHNESS_RANK: Record<FreshnessKey, number> = {
  unknown: -1,
  hot: 1,
  warm: 2,
  cold: 3,
  lost: 4,
};

type Dated = { timestamp?: string };
type LeadLike = { created_at?: string; messages?: Dated[] };

/** Hours since the newest dated touch, or null when the record carries no usable date. */
export function hoursSinceLastTouch(lead: LeadLike | null | undefined, now: Date = new Date()): number | null {
  const stamps: number[] = [];
  for (const msg of lead?.messages ?? []) {
    const at = Date.parse(String(msg?.timestamp ?? ""));
    if (!Number.isNaN(at)) stamps.push(at);
  }
  if (stamps.length === 0 && lead?.created_at) {
    const at = Date.parse(lead.created_at);
    if (!Number.isNaN(at)) stamps.push(at);
  }
  if (stamps.length === 0) return null;
  const newest = Math.max(...stamps);
  return (now.getTime() - newest) / 3_600_000;
}

export function freshnessOf(hours: number | null): { key: FreshnessKey; label: string; rank: number } {
  const key: FreshnessKey =
    hours === null || Number.isNaN(hours) ? "unknown"
      : hours < 24 ? "hot"
        : hours < 72 ? "warm"
          : hours < 168 ? "cold"
            : "lost";
  return { key, label: FRESHNESS_LABELS[key], rank: FRESHNESS_RANK[key] };
}

/**
 * «يحتاج رد دلوقتى» — silent for at least a day and not yet past a week. A hotter
 * lead than a day is not late; a colder one has already gone quiet, and shouting
 * about it every day trains him to ignore the badge.
 */
export function needsReplyNow(hours: number | null): boolean {
  return hours !== null && hours >= 24 && hours < 168;
}
