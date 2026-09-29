// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { suiteScore } from "@/lib/ops/measured-benchmark";

/**
 * The QA agent used to write `score = passed ? 95 : 45` into the benchmark ledger —
 * two numbers that mean nothing, for a run whose per-test results it had already
 * parsed into `testResults`. The owner asked what the metric means; the honest
 * answer was that it meant nothing, so the metric gets a meaning: the share of the
 * tests that actually ran and were counted, and nothing at all when none did.
 */
describe("the QA suite score is computed from the tests that ran", () => {
  it("scores a run by its counted tests", () => {
    const rows = [
      { status: "passed" }, { status: "passed" }, { status: "passed" },
      { status: "failed" }, { status: "skipped" },
    ];
    expect(suiteScore(rows)).toEqual({ score: 75, counted: 4, passed: 3 });
  });

  it("counts a flaky test against the run, and a skipped one not at all", () => {
    expect(suiteScore([{ status: "passed" }, { status: "flaky" }])?.score).toBe(50);
    expect(suiteScore([{ status: "passed" }, { status: "skipped" }])?.score).toBe(100);
  });

  it("refuses to invent a number when nothing was counted", () => {
    expect(suiteScore([])).toBeNull();
    expect(suiteScore([{ status: "skipped" }])).toBeNull();
    expect(suiteScore(undefined)).toBeNull();
  });

  it("is what the QA agent writes, with no fixed 95 or 45 left behind", () => {
    const agent = readFileSync("lib/ops/QayyimQaAgent.ts", "utf8");
    expect(agent).toContain("suiteScore");
    expect(agent).not.toMatch(/passed \? 95 : 45/);
    expect(agent).not.toMatch(/duration_ms:\s*2000/);
  });
});
