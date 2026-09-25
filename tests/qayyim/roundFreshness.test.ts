// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  freshnessFrom,
  describeFreshness,
  ROUND_STALE_MS,
} from "@/lib/qayyim/round-freshness";

const now = new Date("2026-09-25T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600e3).toISOString();

describe("freshnessFrom", () => {
  it("calls a round from this morning fresh", () => {
    const f = freshnessFrom(hoursAgo(5), now);
    expect(f.overdue).toBe(false);
    expect(f.ageHours).toBe(5);
  });

  it("calls yesterday's round overdue", () => {
    const f = freshnessFrom(hoursAgo(30), now);
    expect(f.overdue).toBe(true);
    expect(f.ageHours).toBe(30);
  });

  it("treats a round that never happened as overdue, not as fresh", () => {
    const f = freshnessFrom(null, now);
    expect(f.overdue).toBe(true);
    expect(f.lastAt).toBeNull();
  });

  it("never reports an unreadable log as healthy", () => {
    const f = freshnessFrom(null, now, true);
    expect(f.unreadable).toBe(true);
    expect(f.overdue).toBe(true);
  });

  it("survives a garbage timestamp instead of claiming freshness", () => {
    const f = freshnessFrom("not-a-date", now);
    expect(f.overdue).toBe(true);
    expect(f.ageHours).toBeNull();
  });

  it("clamps a future timestamp to zero age but keeps it non-overdue", () => {
    const f = freshnessFrom(hoursAgo(-2), now);
    expect(f.ageHours).toBe(0);
    expect(f.overdue).toBe(false);
  });

  it("keeps the stale window at just over a day", () => {
    expect(ROUND_STALE_MS / 3600e3).toBeGreaterThanOrEqual(24);
    expect(ROUND_STALE_MS / 3600e3).toBeLessThan(32);
  });
});

describe("describeFreshness", () => {
  it("says plainly that the round never ran", () => {
    expect(describeFreshness(freshnessFrom(null, now))).toContain("لم تعمل أبدًا");
  });

  it("names the delay when the scheduler went quiet", () => {
    expect(describeFreshness(freshnessFrom(hoursAgo(40), now))).toContain("متأخرة");
  });

  it("does not dress up an unreadable log as a missing round", () => {
    expect(describeFreshness(freshnessFrom(null, now, true))).toContain("غير معروف");
  });

  it("reads as Arabic prose for the prompt digest", () => {
    const line = describeFreshness(freshnessFrom(hoursAgo(3), now));
    expect(line.startsWith("آخر جولة يومية:")).toBe(true);
    expect(line).not.toMatch(/null|undefined|NaN/);
  });
});
