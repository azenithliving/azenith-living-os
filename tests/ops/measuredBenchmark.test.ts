// @vitest-environment node
import { describe, it, expect } from "vitest";
import { measuredNumber } from "@/lib/ops/measured-benchmark";

/**
 * The swarm's benchmark ledger has a NOT NULL numeric column, and three of its
 * writers filled that column with a number they had not measured whenever the model
 * prose gave them nothing: the luxury agent wrote `0`, the bundle agent wrote `75`,
 * and a passing grade of 75 is exactly what makes a fake run look healthy. Measured
 * on the live database: 61 of the 75 luxury rows are zero while the last real
 * reading was 88 — so the studio card the owner reads every morning says «صفر»
 * about a store the swarm itself scored at 88.
 *
 * `measuredNumber` is the one decision that separates «I measured this» from «I
 * have nothing», and it returns null rather than a placeholder.
 */
describe("a benchmark records only what was actually measured", () => {
  it("passes through a real reading, including a genuine zero", () => {
    expect(measuredNumber(88)).toBe(88);
    expect(measuredNumber(0)).toBe(0);
    expect(measuredNumber(59.4)).toBe(59.4);
  });

  it("refuses to invent a number when the extraction found nothing", () => {
    for (const nothing of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(measuredNumber(nothing), String(nothing)).toBeNull();
    }
  });

  /**
   * A model that answers «٨٨» or «88/100» in prose hands over a string, not a
   * measurement. Storing it as text would have been its own bug; the ledger column
   * is numeric, so an unparsed string is a missing reading, nothing more.
   */
  it("treats prose as a missing reading, not a score", () => {
    for (const text of ["88", "٨٨", "88/100", "", "  ", "n/a", {}, [], { total: 88 }]) {
      expect(measuredNumber(text as never), JSON.stringify(text)).toBeNull();
    }
  });
});
