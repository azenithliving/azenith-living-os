// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  mean,
  std,
  zScore,
  normalCdf,
  twoProportionZTest,
  requiredVisitorsPerArm,
  detectAnomalies,
  holtWinters,
} from "@/lib/qayyim/stats";

/**
 * P6-M3: the swarm's arithmetic. Pure and hand-written — no npm dependency was
 * added for it, and nothing here touches the database, so a wrong number is a
 * failing unit test rather than a wrong page.
 *
 * The reason the module exists: the free-tier models behind the swarm are bad at
 * maths and will state a confident p-value they invented. These functions own
 * the numbers; the model is only allowed to explain them.
 */

describe("mean / std / zScore", () => {
  it("averages", () => expect(mean([2, 4, 6])).toBe(4));
  it("refuses an empty series instead of returning 0", () => expect(mean([])).toBeNull());
  it("ignores non-finite values", () => expect(mean([2, NaN, 6])).toBe(4));

  // A window that IS the whole observation (daily counts for 30 days) is a
  // population, so ddof stays 0 unless the caller asks for a sample.
  it("spreads over the population by default", () => {
    expect(std([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 9);
  });
  it("uses the sample formula when asked", () => {
    expect(std([2, 4, 4, 4, 5, 5, 7, 9], true)).toBeCloseTo(2.1381, 4);
  });
  it("needs two points before it can spread", () => {
    expect(std([5])).toBeNull();
    expect(std([])).toBeNull();
  });

  it("centres a value that equals the mean", () => expect(zScore(6, [2, 4, 6, 8, 10])).toBeCloseTo(0, 9));
  // [2,4,6,8,10] has mean 6 and population sigma √8, so 10 sits √2 sigmas out.
  it("is 1.41 sigmas out", () => expect(zScore(10, [2, 4, 6, 8, 10])).toBeCloseTo(1.41421, 4));
  it("stays null on a flat or single-point series", () => {
    expect(zScore(5, [5, 5, 5])).toBeNull();
    expect(zScore(5, [5])).toBeNull();
  });
});

describe("normalCdf", () => {
  it("is 0.5 at zero", () => expect(normalCdf(0)).toBeCloseTo(0.5, 6));
  it("matches the 1.96 sigma table value", () => expect(normalCdf(1.959964)).toBeCloseTo(0.975, 4));
  it("is symmetric", () => expect(normalCdf(-1.959964)).toBeCloseTo(0.025, 4));
});

describe("twoProportionZTest", () => {
  it("detects a real 10% → 13% lift", () => {
    const r = twoProportionZTest(1000, 100, 1000, 130);
    expect(r.controlRate).toBeCloseTo(0.1, 9);
    expect(r.treatmentRate).toBeCloseTo(0.13, 9);
    expect(r.z).toBeCloseTo(2.1027, 4);
    expect(r.p).toBeCloseTo(0.0355, 4);
    expect(r.significant).toBe(true);
    expect(r.treatmentWins).toBe(true);
    expect(r.verdict).toBe("measured");
  });

  it("calls a coin flip inconclusive", () => {
    const r = twoProportionZTest(1000, 100, 1000, 104);
    expect(r.significant).toBe(false);
    expect(r.treatmentWins).toBeNull();
  });

  it("can say the variant lost", () => {
    const r = twoProportionZTest(1000, 130, 1000, 90);
    expect(r.significant).toBe(true);
    expect(r.treatmentWins).toBe(false);
  });

  it("refuses to judge an arm nobody saw", () => {
    const r = twoProportionZTest(0, 0, 500, 40);
    expect(r.z).toBeNull();
    expect(r.p).toBeNull();
    expect(r.treatmentWins).toBeNull();
    expect(r.verdict).toBe("no-data");
  });

  it("refuses to judge a metric that never converted anywhere", () => {
    const r = twoProportionZTest(500, 0, 500, 0);
    expect(r.verdict).toBe("no-conversions");
    expect(r.significant).toBe(false);
  });

  it("guards against impossible counts", () => {
    const r = twoProportionZTest(100, 150, 100, 10);
    expect(r.verdict).toBe("invalid");
    expect(r.z).toBeNull();
  });

  // The normal approximation is not trustworthy on a handful of visitors, and a
  // luxury shop can easily have 6 people on a page. Fewer than 30 per arm is
  // reported as no-data rather than as a tie.
  it("will not judge an arm with too few visitors", () => {
    const r = twoProportionZTest(12, 4, 9, 1);
    expect(r.verdict).toBe("no-data");
    expect(r.significant).toBe(false);
    expect(r.controlRate).toBeCloseTo(4 / 12, 6);
    expect(r.treatmentRate).toBeCloseTo(1 / 9, 6);
  });
});

describe("requiredVisitorsPerArm", () => {
  it("sizes a 10% baseline for a 30% relative lift", () => {
    const n = requiredVisitorsPerArm({ baselineRate: 0.1, relativeLift: 0.3 });
    expect(n).not.toBeNull();
    expect(n!).toBeGreaterThan(1700);
    expect(n!).toBeLessThan(1850);
  });

  it("needs far more traffic to see a small change", () => {
    const big = requiredVisitorsPerArm({ baselineRate: 0.1, relativeLift: 0.3 })!;
    const small = requiredVisitorsPerArm({ baselineRate: 0.1, relativeLift: 0.05 })!;
    expect(small).toBeGreaterThan(big * 20);
  });

  it("refuses a baseline that cannot move", () => {
    expect(requiredVisitorsPerArm({ baselineRate: 0, relativeLift: 0.2 })).toBeNull();
    expect(requiredVisitorsPerArm({ baselineRate: 0.5, relativeLift: 0 })).toBeNull();
  });
});

describe("detectAnomalies", () => {
  it("flags a 4x spike in a steady stream", () => {
    const series = [...Array(29).fill(100), 400];
    const hits = detectAnomalies(series);
    expect(hits).toHaveLength(1);
    expect(hits[0].index).toBe(29);
    expect(hits[0].z).toBeGreaterThan(3);
  });

  it("says nothing about a flat series", () => {
    expect(detectAnomalies([...Array(20).fill(7)])).toEqual([]);
  });

  it("does not judge fewer points than it needs", () => {
    expect(detectAnomalies([1, 9, 2, 80])).toEqual([]);
  });

  it("respects a looser threshold", () => {
    const series = [...Array(29).fill(100), 400];
    expect(detectAnomalies(series, { k: 10 })).toEqual([]);
  });
});

/** A seasonal shop series: rising trend, seven-day week, one day sells out. */
function seasonalSeries(weeks = 8): number[] {
  const shape = [8, 9, 10, 11, 12, 13, 22];
  const out: number[] = [];
  for (let t = 0; t < weeks * 7; t++) {
    out.push(100 + t * 1.5 + shape[t % 7] * 4 + ((t % 3) - 1) * 1.5);
  }
  return out;
}

describe("holtWinters", () => {
  it("projects one point per horizon step", () => {
    const r = holtWinters(seasonalSeries(), { seasonLength: 7, horizon: 7 });
    expect(r.method).toBe("holt-winters");
    expect(r.forecast).toHaveLength(7);
    r.forecast.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });

  it("keeps the weekly shape it was taught", () => {
    const r = holtWinters(seasonalSeries(), { seasonLength: 7, horizon: 7 });
    // The series peaks on the 7th day of each week, so the peak sits last.
    expect(r.forecast.indexOf(Math.max(...r.forecast))).toBe(6);
  });

  it("fits the seasonal series closely", () => {
    const r = holtWinters(seasonalSeries(), { seasonLength: 7, horizon: 7 });
    expect(r.mape).not.toBeNull();
    expect(r.mape!).toBeLessThan(10);
  });

  it("falls back when there are not two full seasons", () => {
    const r = holtWinters([10, 12, 11, 13, 12, 14, 13, 15, 14, 16], { seasonLength: 7, horizon: 3 });
    expect(r.method).toBe("double-exponential");
    expect(r.forecast).toHaveLength(3);
  });

  it("refuses to forecast from one number", () => {
    const r = holtWinters([42], { seasonLength: 7, horizon: 3 });
    expect(r.method).toBe("insufficient-data");
    expect(r.forecast).toEqual([]);
    expect(r.mape).toBeNull();
  });

  it("keeps a flat history flat instead of inventing a trend", () => {
    const r = holtWinters([...Array(14).fill(50)], { seasonLength: 7, horizon: 4 });
    r.forecast.forEach((v) => expect(v).toBeCloseTo(50, 6));
  });

  it("follows a clean upward trend upward", () => {
    const r = holtWinters([10, 12, 14, 16, 18, 20, 22, 24], { seasonLength: 3, horizon: 2 });
    expect(r.method).toBe("holt-winters");
    expect(r.forecast[0]).toBeGreaterThan(24);
    expect(r.forecast[1]).toBeGreaterThan(r.forecast[0]);
  });

  it("survives an all-zero series without dividing by nothing", () => {
    const r = holtWinters(Array.from({ length: 14 }, () => 0), { seasonLength: 7, horizon: 3 });
    expect(r.mape).toBeNull();
    r.forecast.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});
