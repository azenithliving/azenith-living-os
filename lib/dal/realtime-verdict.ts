/**
 * realtime-verdict.ts — whether the record can carry a table live at all.
 *
 * A realtime subscription costs nothing when it is wrong: the channel opens, the callback
 * never fires, and the caller believes it has a live feed. So the answer comes from the
 * record itself — the tables listed in `lib/dal/record-schema.json`, measured from the
 * record's own publication by `scratch/measure-dal-columns.mjs`, never written by hand.
 *
 * Measured 2026-11-04: the publication carries five tables, and neither `agent_events` nor
 * `ops_sync_events` is among them — every realtime alert channel the store could open would
 * have been silent forever.
 */
import snapshot from "./record-schema.json";

export type RealtimeReason = "published" | "not-published" | "unmeasured";

export interface RealtimeVerdict {
  table: string;
  usable: boolean;
  reason: RealtimeReason;
  measuredAt: string | null;
  publishedCount: number;
}

const published = snapshot.realtime?.publishedTables ?? [];
const measuredAt = snapshot.realtime?.measuredAt ?? null;

export function realtimeChannelVerdict(
  table: string,
  list: string[] = published,
): RealtimeVerdict {
  if (!list.length) {
    return { table, usable: false, reason: "unmeasured", measuredAt, publishedCount: 0 };
  }
  const usable = list.includes(table);
  return {
    table,
    usable,
    reason: usable ? "published" : "not-published",
    measuredAt,
    publishedCount: list.length,
  };
}

export function publishedRealtimeTables(): string[] {
  return [...published];
}
