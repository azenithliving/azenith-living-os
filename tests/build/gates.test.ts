// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseVitestSummary, gateReport, formatGateBlock, type GateResults } from "@/lib/build/gates";

/**
 * The four publish gates were a convention written in prose. This is the machine that turns the
 * convention into one command: parse what each gate printed, and refuse to call a run green when a
 * gate did not run at all. A gate that never ran is not a pass.
 */

const ESC = String.fromCharCode(27);

describe("parseVitestSummary", () => {
  it("reads the real summary line, colours and all", () => {
    const text = [
      `  ${ESC}[33m❯${ESC}[39m tests/ops/x.test.ts (9 tests | 1 skipped)`,
      `${ESC}[2m Test Files${ESC}[22m ${ESC}[1m${ESC}[32m212 passed${ESC}[39m${ESC}[22m${ESC}[2m | 2 skipped${ESC}[22m ${ESC}[2m(214)${ESC}[22m`,
      `${ESC}[2m      Tests${ESC}[22m ${ESC}[1m${ESC}[32m2483 passed${ESC}[39m${ESC}[22m${ESC}[2m | 3 skipped${ESC}[22m ${ESC}[2m(2486)${ESC}[22m`,
    ].join("\n");

    expect(parseVitestSummary(text)).toEqual({ files: 214, tests: 2486, passed: 2483, skipped: 3, failed: 0 });
  });

  it("returns nulls, never zeros, when the run printed no summary", () => {
    expect(parseVitestSummary("Some other output\nnothing here")).toEqual({
      files: null,
      tests: null,
      passed: null,
      skipped: null,
      failed: null,
    });
  });

  it("counts the failing files it names", () => {
    const text = `Test Files 2 failed | 212 passed (214)\n      Tests 3 failed | 2480 passed (2486)`;
    const parsed = parseVitestSummary(text);
    expect(parsed.failed).toBe(3);
    expect(parsed.passed).toBe(2480);
  });
});

describe("gateReport", () => {
  it("names the gate that refused", () => {
    const results: GateResults = {
      tests: { exit: 0, detail: "2486" },
      typecheck: { exit: 0, detail: "" },
      build: { exit: 1, detail: "Failed to compile" },
      live: { exit: 0, detail: "11 of 11" },
    };

    expect(gateReport(results)).toEqual({ ok: false, failed: ["build"], notRun: [] });
  });

  it("refuses to call a skipped gate a pass", () => {
    const results: GateResults = {
      tests: { exit: 0, detail: "2486" },
      typecheck: { exit: null, detail: "لم يُشغَّل" },
      build: { exit: 0, detail: "" },
      live: { exit: null, detail: "لم يُشغَّل" },
    };

    const report = gateReport(results);
    expect(report.ok).toBe(false);
    expect(report.failed).toEqual([]);
    expect(report.notRun.sort()).toEqual(["live", "typecheck"]);
  });

  it("is green only when all four gates ran and answered zero", () => {
    const results: GateResults = {
      tests: { exit: 0, detail: "2486" },
      typecheck: { exit: 0, detail: "" },
      build: { exit: 0, detail: "" },
      live: { exit: 0, detail: "11 of 11" },
    };

    expect(gateReport(results).ok).toBe(true);
  });
});

describe("formatGateBlock", () => {
  it("prints every gate with what it answered, and says not-run out loud", () => {
    const results: GateResults = {
      tests: { exit: 0, detail: "2486 passed" },
      typecheck: { exit: 0, detail: "clean" },
      build: { exit: 1, detail: "Failed to compile" },
      live: { exit: null, detail: "" },
    };

    const block = formatGateBlock(gateReport(results), results);
    expect(block).toContain("tests=PASS 2486 passed");
    expect(block).toContain("build=REFUSED");
    expect(block).toContain("live=NOT-RUN");
    expect(block).toContain("GATES: REFUSED");
  });
});
