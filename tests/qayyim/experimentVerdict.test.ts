// @vitest-environment node
import { describe, it, expect } from "vitest";
import { verdictForExperiment } from "@/lib/qayyim/experiment-verdict";

/**
 * What an A/B number means to the owner, in words he can act on.
 *
 * Separated from `ab-testing.ts` on purpose: the DB read is not interesting, and
 * the sentence is the part that has to be right. "مش حاسم بعد" without a number
 * attached is a shrug; with «محتاج ~1772 زائر لكل ناحية» it is a plan.
 */

const steady = {
  controlImpressions: 1000,
  controlConversions: 100,
  variantImpressions: 1000,
  variantConversions: 130,
  minimumDetectableEffect: 30,
};

describe("verdictForExperiment", () => {
  it("calls a decisive win a win", () => {
    const v = verdictForExperiment(steady);
    expect(v.status).toBe("decisive-variant");
    expect(v.confidence).toBeCloseTo(0.9645, 3);
    expect(v.text).toContain("كسب");
  });

  it("says so when the new version lost", () => {
    const v = verdictForExperiment({ ...steady, variantConversions: 70 });
    expect(v.status).toBe("decisive-control");
    expect(v.text).toContain("الأقدم");
  });

  it("refuses to call a tie decisive and prices the extra traffic", () => {
    const v = verdictForExperiment({ ...steady, variantConversions: 104 });
    expect(v.status).toBe("inconclusive");
    expect(v.text).toContain("مش حاسم بعد");
    expect(v.requiredVisitorsPerArm).toBeGreaterThan(1700);
    expect(v.text).toContain(String(v.requiredVisitorsPerArm));
  });

  it("has nothing to price when nothing converted", () => {
    const v = verdictForExperiment({ ...steady, controlConversions: 0, variantConversions: 0 });
    expect(v.status).toBe("no-data");
    expect(v.requiredVisitorsPerArm).toBeNull();
    expect(v.text).toContain("مفيش");
  });

  it("sees an arm nobody visited as no data", () => {
    const v = verdictForExperiment({ ...steady, variantImpressions: 0, variantConversions: 0 });
    expect(v.status).toBe("no-data");
  });

  it("never leaves a slash in the sentence", () => {
    // A slash in an Arabic admin label gets rewritten by the link guard, so the
    // copy avoids it — this test keeps new wording honest.
    const inputs = [
      steady,
      { ...steady, variantConversions: 104 },
      { ...steady, variantConversions: 70 },
      { ...steady, controlConversions: 0, variantConversions: 0 },
    ];
    inputs.forEach((input) => {
      expect(verdictForExperiment(input).text).not.toContain("/");
    });
  });

  it("keeps the numbers it quotes consistent with the input", () => {
    const v = verdictForExperiment(steady);
    expect(v.text).toContain("10");
    expect(v.text).toContain("13");
  });
});
