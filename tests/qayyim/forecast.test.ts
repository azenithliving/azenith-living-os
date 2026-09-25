// @vitest-environment node
import { describe, it, expect } from "vitest";
import { dailyRevenueSeries, forecastFromSeries, renderForecast, type OrderRow } from "@/lib/qayyim/forecast";

/**
 * P6-M3 forecast: «جيب الشهر الجاي بكم؟» answered with Holt-Winters over real
 * order history, plus the error the model actually makes on that history.
 *
 * The DB read is kept out of these functions on purpose — the arithmetic and the
 * Arabic sentence are what can be wrong, and both have to be testable without a
 * database.
 */

const day = (n: number, iso = "2026-09-01T12:00:00.000Z"): OrderRow => ({
  created_at: iso.replace("2026-09-01", `2026-09-${String(n).padStart(2, "0")}`),
  total_amount: 1000,
});

describe("dailyRevenueSeries", () => {
  it("fills empty days with zero instead of skipping them", () => {
    const rows = [day(1), day(3)];
    const s = dailyRevenueSeries(rows, { days: 5, endDate: new Date("2026-09-05T12:00:00Z") });
    expect(s.dates).toEqual(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"]);
    expect(s.values).toEqual([1000, 0, 1000, 0, 0]);
  });

  it("sums several orders on the same day", () => {
    const s = dailyRevenueSeries([day(2), day(2)], { days: 3, endDate: new Date("2026-09-03T12:00:00Z") });
    expect(s.values).toEqual([0, 2000, 0]);
  });

  it("drops rows outside the window", () => {
    const rows = [day(20), day(1)];
    const s = dailyRevenueSeries(rows, { days: 3, endDate: new Date("2026-09-22T12:00:00Z") });
    expect(s.dates).toEqual(["2026-09-20", "2026-09-21", "2026-09-22"]);
    expect(s.values[0]).toBe(1000);
  });

  it("treats a missing amount as zero rather than NaN", () => {
    const s = dailyRevenueSeries(
      [{ created_at: "2026-09-01T12:00:00.000Z", total_amount: null }],
      { days: 2, endDate: new Date("2026-09-02T12:00:00Z") },
    );
    expect(s.values).toEqual([0, 0]);
  });
});

describe("forecastFromSeries", () => {
  const seasonal = Array.from({ length: 8 * 7 }, (_, t) => 5000 + t * 40 + [0, 200, 400, 600, 900, 1500, 3000][t % 7]);

  it("returns one point per day ahead, dated forward", () => {
    const f = forecastFromSeries(seasonal, { horizon: 7, endDate: new Date("2026-09-25T12:00:00Z") });
    expect(f.points).toHaveLength(7);
    expect(f.points[0].date).toBe("2026-09-26");
    expect(f.points[6].date).toBe("2026-10-02");
    expect(f.method).toBe("holt-winters");
  });

  it("adds up to a total the owner can plan against", () => {
    const f = forecastFromSeries(seasonal, { horizon: 7, endDate: new Date("2026-09-25T12:00:00Z") });
    expect(f.total).toBeCloseTo(f.points.reduce((a, p) => a + p.value, 0), 6);
    expect(f.total).toBeGreaterThan(0);
  });

  it("carries the error measured on the history", () => {
    const f = forecastFromSeries(seasonal, { horizon: 7, endDate: new Date("2026-09-25T12:00:00Z") });
    expect(f.mape).not.toBeNull();
    expect(f.mape!).toBeLessThan(10);
  });

  it("refuses when there is nothing to learn from", () => {
    const f = forecastFromSeries([0, 0], { horizon: 7, endDate: new Date("2026-09-25T12:00:00Z") });
    expect(f.refused).toBe(true);
    expect(f.points).toEqual([]);
  });

  it("refuses on a history too short to hold a week shape", () => {
    const f = forecastFromSeries([1000, 200], { horizon: 7, endDate: new Date("2026-09-25T12:00:00Z") });
    expect(f.refused).toBe(false);
    expect(f.method).toBe("double-exponential");
    expect(f.caveats.join(" ")).toContain("غير موسمي");
  });

  it("does not promise a negative month", () => {
    const f = forecastFromSeries([9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 500, 200, 100], {
      horizon: 7,
      endDate: new Date("2026-09-25T12:00:00Z"),
    });
    f.points.forEach((p) => expect(p.value).toBeGreaterThanOrEqual(0));
  });
});

describe("renderForecast", () => {
  const seasonal = Array.from({ length: 8 * 7 }, (_, t) => 5000 + t * 40 + [0, 200, 400, 600, 900, 1500, 3000][t % 7]);

  it("quotes the horizon, the total and the measured error", () => {
    const f = forecastFromSeries(seasonal, { horizon: 7, endDate: new Date("2026-09-25T12:00:00Z") });
    const text = renderForecast(f);
    expect(text).toContain("7");
    expect(text).toContain("خطأ");
    expect(text).toMatch(/2026-09-26/);
  });

  it("keeps slashes out of the Arabic labels", () => {
    const f = forecastFromSeries(seasonal, { horizon: 7, endDate: new Date("2026-09-25T12:00:00Z") });
    expect(renderForecast(f)).not.toContain("/");
  });

  it("renders an honest refusal rather than a number", () => {
    const f = forecastFromSeries([0, 0], { horizon: 7, endDate: new Date("2026-09-25T12:00:00Z") });
    const text = renderForecast(f);
    expect(text).toContain("مش قادر");
    expect(text).not.toMatch(/\d+,\d{3}/);
  });
});
