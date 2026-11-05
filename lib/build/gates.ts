/**
 * gates.ts — the four publish gates as one machine, not one paragraph.
 *
 * The programme said: tests, typecheck, full build, and a live measurement at phone width with a
 * screenshot actually looked at. It was written in prose, so an agent could run three of them and
 * still say "published". This module parses what each gate printed and refuses green when a gate
 * did not run at all.
 */
export type GateName = "tests" | "typecheck" | "build" | "live";

export interface GateResult {
  /** The command's exit code, or null when the gate never ran. */
  exit: number | null;
  detail: string;
}

export type GateResults = Record<GateName, GateResult>;

export interface GateReport {
  ok: boolean;
  failed: GateName[];
  notRun: GateName[];
}

export interface VitestSummary {
  files: number | null;
  tests: number | null;
  passed: number | null;
  skipped: number | null;
  failed: number | null;
}

const GATE_ORDER: GateName[] = ["tests", "typecheck", "build", "live"];

const stripAnsi = (text: string) => text.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");

/** `Test Files 2 failed | 212 passed | 2 skipped (214)` — the numbers only exist if the line printed. */
function parseSummaryLine(line: string): { passed: number | null; skipped: number | null; failed: number | null; total: number | null } {
  const total = Number(/\((\d+)\)/.exec(line)?.[1] ?? NaN);
  const passed = /(\d+) passed/.exec(line)?.[1];
  const skipped = /(\d+) skipped/.exec(line)?.[1];
  const failed = /(\d+) failed/.exec(line)?.[1];
  return {
    passed: passed === undefined ? 0 : Number(passed),
    skipped: skipped === undefined ? 0 : Number(skipped),
    failed: failed === undefined ? 0 : Number(failed),
    total: Number.isFinite(total) ? total : null,
  };
}

export function parseVitestSummary(text: string): VitestSummary {
  const clean = stripAnsi(text);
  const fileLine = /^\s*Test Files.*$/m.exec(clean)?.[0];
  const testLine = /^\s*Tests\s+.*$/m.exec(clean)?.[0];
  if (!fileLine || !testLine) {
    return { files: null, tests: null, passed: null, skipped: null, failed: null };
  }
  const files = parseSummaryLine(fileLine);
  const tests = parseSummaryLine(testLine);
  return {
    files: files.total,
    tests: tests.total,
    passed: tests.passed,
    skipped: tests.skipped,
    failed: tests.failed,
  };
}

export function gateReport(results: GateResults): GateReport {
  const failed: GateName[] = [];
  const notRun: GateName[] = [];
  for (const name of GATE_ORDER) {
    const exit = results[name]?.exit;
    if (exit === null || exit === undefined) notRun.push(name);
    else if (exit !== 0) failed.push(name);
  }
  return { ok: failed.length === 0 && notRun.length === 0, failed, notRun };
}

export function formatGateBlock(report: GateReport, results: GateResults): string {
  const lines = GATE_ORDER.map((name) => {
    const result = results[name];
    const state =
      result?.exit === null || result?.exit === undefined
        ? "NOT-RUN"
        : result.exit === 0
          ? "PASS"
          : "REFUSED";
    const detail = result?.detail?.trim() ? ` ${result.detail.trim()}` : "";
    return `${name}=${state}${detail}`;
  });
  return [`GATES: ${report.ok ? "GREEN" : "REFUSED"}`, ...lines].join("\n");
}
