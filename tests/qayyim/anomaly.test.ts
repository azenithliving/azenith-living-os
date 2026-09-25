// @vitest-environment node
import { describe, it, expect } from "vitest";
import { anomalyFromCounts, buildDailyCounts, renderAnomalyDigest, type DayCount } from "@/lib/qayyim/anomaly";

/**
 * P6-M3 anomaly watch: "did yesterday look like this shop at all?"
 *
 * The pure half lives in `anomaly.ts` next to the arithmetic, and is argued with
 * here; the DB read only feeds it.
 */

const stamps = (dates: string[]) => dates.map((d) => `${d}T12:00:00.000Z`);

/** A week that repeats with a normal jagged shape — 28 days of it. */
function ordinaryDays(): number[] {
  const week = [8, 11, 9, 13, 10, 12, 7];
  return Array.from({ length: 28 }, (_, i) => week[i % 7]);
}

function asSeries(counts: number[], endDate = new Date("2026-08-28T20:00:00Z")): DayCount[] {
  return Array.from({ length: counts.length }, (_, i) => ({
    date: new Date(endDate.getTime() - (counts.length - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    count: counts[i],
  }));
}

describe("buildDailyCounts", () => {
  it("zero-fills days with no traffic", () => {
    const counts = buildDailyCounts(stamps(["2026-08-01", "2026-08-01", "2026-08-03"]), {
      endDate: new Date("2026-08-05T00:00:00Z"),
      days: 5,
    });
    expect(counts.map((c) => c.count)).toEqual([2, 0, 1, 0, 0]);
    expect(counts[0].date).toBe("2026-08-01");
  });

  it("drops rows outside the window", () => {
    const counts = buildDailyCounts(stamps(["2026-07-01", "2026-08-05"]), {
      endDate: new Date("2026-08-05T00:00:00Z"),
      days: 3,
    });
    expect(counts.map((c) => c.count)).toEqual([0, 0, 1]);
  });
});

describe("anomalyFromCounts", () => {
  it("stays quiet on an ordinary fortnight", () => {
    expect(anomalyFromCounts(asSeries(ordinaryDays()))).toEqual([]);
  });

  it("calls a 10x day abnormal", () => {
    const days = ordinaryDays();
    days[days.length - 1] = 120;
    const hits = anomalyFromCounts(asSeries(days));
    expect(hits).toHaveLength(1);
    expect(hits[0].z).toBeGreaterThan(3);
    expect(hits[0].count).toBe(120);
    // The "normal level" is a typical day, not the spike-inflated mean.
    expect(hits[0].baseline).toBeGreaterThanOrEqual(7);
    expect(hits[0].baseline).toBeLessThanOrEqual(13);
  });

  it("hears a collapse too, not only a spike", () => {
    const days = ordinaryDays();
    days[days.length - 1] = 0;
    days[days.length - 2] = 0;
    const hits = anomalyFromCounts(asSeries(days));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.z < 0)).toBe(true);
  });

  // A spike two weeks ago is history, not news. Re-reporting it every morning is
  // how a watchdog gets muted.
  it("only reports the recent edge", () => {
    const days = ordinaryDays();
    days[3] = 150;
    expect(anomalyFromCounts(asSeries(days))).toEqual([]);
    expect(anomalyFromCounts(asSeries(days), { recentDays: 28 })).toHaveLength(1);
  });

  it("says nothing when there is not enough history", () => {
    expect(anomalyFromCounts(asSeries(ordinaryDays().slice(-4)))).toEqual([]);
  });

  it("does not shout about a dead shop", () => {
    expect(anomalyFromCounts(asSeries(Array.from({ length: 28 }, () => 0)))).toEqual([]);
  });
});

describe("renderAnomalyDigest", () => {
  it("names the day, the count and the normal level", () => {
    const days = ordinaryDays();
    days[days.length - 1] = 120;
    const text = renderAnomalyDigest(anomalyFromCounts(asSeries(days)));
    expect(text).toContain("2026-08-28");
    expect(text).toContain("120");
    expect(text).not.toContain("/");
  });

  it("keeps the empty case short", () => {
    expect(renderAnomalyDigest([])).toContain("مفيش");
  });
});
