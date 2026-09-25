// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  compositeLuxury,
  loadScore,
  ratioScore,
  type LuxurySignals,
} from "@/lib/qayyim/luxury-v2";

const full: LuxurySignals = {
  imageCompleteness: 1, // every active product has a main image
  priceDisclosed: 1,
  seoScore: 100,
  loadP95Ms: 1200,
  altCoverage: 1,
};

describe("loadScore", () => {
  it("is 100 up to the fast threshold and 0 at or beyond the slow one", () => {
    expect(loadScore(400)).toBe(100);
    expect(loadScore(1500)).toBe(100);
    expect(loadScore(4000)).toBe(0);
    expect(loadScore(9000)).toBe(0);
  });

  it("falls linearly between the thresholds", () => {
    expect(loadScore(2750)).toBe(50); // midpoint of 1500..4000
  });

  it("treats an unreadable timing as no signal, not as slow", () => {
    expect(loadScore(null)).toBeNull();
    expect(loadScore(Number.NaN)).toBeNull();
  });
});

describe("ratioScore", () => {
  it("turns a fraction into a percentage and clamps noise", () => {
    expect(ratioScore(0.5)).toBe(50);
    expect(ratioScore(1.4)).toBe(100);
    expect(ratioScore(-2)).toBe(0);
    expect(ratioScore(null)).toBeNull();
    expect(ratioScore(0 / 0)).toBeNull();
  });
});

describe("compositeLuxury", () => {
  it("scores a perfect shop at 100", () => {
    const r = compositeLuxury(full);
    expect(r.score).toBe(100);
    expect(r.missing).toEqual([]);
  });

  it("weights measured signals and renormalises when one is absent", () => {
    const withAll = compositeLuxury(full);
    const noSeo = compositeLuxury({ ...full, seoScore: null });
    // dropping the SEO signal must not drag the score toward zero: the missing
    // weight is redistributed, and `missing` says so out loud.
    expect(noSeo.missing.join(" ")).toContain("SEO");
    expect(Math.abs(noSeo.score - withAll.score)).toBeLessThan(12);
  });

  it("refuses to invent a score when nothing was measured", () => {
    const r = compositeLuxury({
      imageCompleteness: null,
      priceDisclosed: null,
      seoScore: null,
      loadP95Ms: null,
      altCoverage: null,
    });
    expect(r.score).toBeNull();
    expect(r.missing.length).toBe(5);
  });

  it("reports a breakdown a human can act on", () => {
    const r = compositeLuxury({ ...full, imageCompleteness: 0.25 });
    const img = r.breakdown.find((b) => b.key === "imageCompleteness");
    expect(img?.value).toBe(25);
    expect(r.score).toBeLessThan(90);
  });

  it("keeps the historical field name so old readers do not break", () => {
    const r = compositeLuxury(full);
    expect(typeof r.score).toBe("number");
  });
});
