// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  hoursSinceLastTouch,
  freshnessOf,
  needsReplyNow,
  FRESHNESS_LABELS,
} from "@/lib/leads-freshness";

/**
 * The first capability the sales office gets after moving: a cold clock. A lead that
 * nobody answered for a week is lost money, and the screen never said so.
 *
 * The rule that shapes this module is the owner's fabrication brake: a missing
 * timestamp is reported as unknown, never as zero hours. A card that says «حار» for a
 * customer whose last message has no date is a machine lying to him.
 */
const NOW = new Date("2026-09-29T12:00:00.000Z");

describe("the cold clock", () => {
  it("measures hours from the newest message, not the first", () => {
    const lead = {
      created_at: "2026-09-01T10:00:00.000Z",
      messages: [
        { timestamp: "2026-09-02T10:00:00.000Z" },
        { timestamp: "2026-09-29T10:00:00.000Z" },
      ],
    };
    expect(hoursSinceLastTouch(lead, NOW)).toBeCloseTo(2, 5);
  });

  it("falls back to the record date when there is no message at all", () => {
    const lead = { created_at: "2026-09-27T12:00:00.000Z", messages: [] };
    expect(hoursSinceLastTouch(lead, NOW)).toBeCloseTo(48, 5);
  });

  it("refuses to guess: no date anywhere is unknown, not zero", () => {
    expect(hoursSinceLastTouch({ messages: [{}] }, NOW)).toBeNull();
    expect(hoursSinceLastTouch({}, NOW)).toBeNull();
    expect(hoursSinceLastTouch({ messages: [{ timestamp: "not-a-date" }] }, NOW)).toBeNull();
  });

  it("names the four states in Arabic and keeps unknown separate from hot", () => {
    expect(hoursSinceLastTouch({ created_at: "2026-09-29T11:00:00.000Z" }, NOW)).toBeCloseTo(1, 5);
    expect(freshnessOf(1).label).toBe(FRESHNESS_LABELS.hot);
    expect(freshnessOf(50).label).toBe(FRESHNESS_LABELS.warm);
    expect(freshnessOf(120).label).toBe(FRESHNESS_LABELS.cold);
    expect(freshnessOf(400).label).toBe(FRESHNESS_LABELS.lost);
    expect(freshnessOf(null).label).toBe(FRESHNESS_LABELS.unknown);
    expect(freshnessOf(null).rank).toBe(-1);
  });

  it("flags what needs an answer now, and never flags the unknown as urgent", () => {
    expect(needsReplyNow(30)).toBe(true);
    expect(needsReplyNow(200)).toBe(false);
    expect(needsReplyNow(null)).toBe(false);
  });
});
