#!/usr/bin/env node
/**
 * gate.mjs — the four publish gates as one command, plus the ruler.
 *
 * Before this, "published" was a claim an agent made in prose: three of the four gates had a
 * command and the fourth (a live measurement at phone width with a screenshot actually looked at)
 * lived in throwaway scripts. Now a phase cannot report green unless all four ran, and a gate that
 * did not run is printed as NOT-RUN instead of passing silently.
 *
 * Usage:
 *   node scripts/gate.mjs                 run tests + typecheck + build; live stays NOT-RUN
 *   node scripts/gate.mjs --live <file>   also run the live proof script (its exit is gate 4)
 *   node scripts/gate.mjs --ruler-only    print the ruler line only (no gates run)
 * The logic lives in lib/build (tested); this file only runs commands and prints.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { formatGateBlock, gateReport, parseVitestSummary } from "../lib/build/gates.ts";
import { formatRulerLine, readRuler } from "../lib/build/ruler.ts";

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const valueAfter = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] ?? null : null);

mkdirSync("scratch", { recursive: true });

function run(label, argv) {
  const [command, ...rest] = argv;
  const child = spawnSync(command, rest, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (child.error) return { exit: null, detail: `the command never ran — ${child.error.message}`, output: "" };
  const output = `${child.stdout ?? ""}${child.stderr ?? ""}`;
  writeFileSync(`scratch/gate-${label}.out`, output, "utf8");
  return { exit: child.status ?? 1, detail: "", output };
}

const lastLine = (text, pattern) => {
  const hits = text.split(/\r?\n/).filter((line) => pattern.test(line));
  return (hits.at(-1) ?? "").trim().slice(0, 120);
};

const results = {
  tests: { exit: null, detail: "لم يُشغَّل" },
  typecheck: { exit: null, detail: "لم يُشغَّل" },
  build: { exit: null, detail: "لم يُشغَّل" },
  live: { exit: null, detail: "لم يُشغَّل" },
};

const rulerOnly = has("--ruler-only");

if (!rulerOnly) {
  const tests = run("tests", ["node", "node_modules/vitest/vitest.mjs", "run"]);
  const summary = parseVitestSummary(tests.output);
  results.tests = {
    exit: tests.exit,
    detail:
      summary.tests === null
        ? "لم يطبع ملخصًا"
        : `${summary.tests} اختبار · ${summary.passed} أخضر · ${summary.failed} أحمر · ${summary.skipped} متخطّى`,
  };

  const tsc = run("typecheck", ["node", "node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.json"]);
  results.typecheck = { exit: tsc.exit, detail: tsc.exit === 0 ? "سليم" : lastLine(tsc.output, /error TS/) };

  const build = run("build", ["node", "node_modules/next/dist/bin/next", "build"]);
  results.build = { exit: build.exit, detail: build.exit === 0 ? "سليم" : lastLine(build.output, /error|Error|Failed to compile/i) };

  const liveScript = valueAfter("--live");
  if (liveScript) {
    const live = run("live", ["node", liveScript]);
    results.live = { exit: live.exit, detail: lastLine(live.output, /RESULT:/) || (live.exit === 0 ? "ردّ صفر" : "رفض") };
  }
}

const ruler = readRuler();
const testCount = /(\d+) اختبار/.exec(results.tests.detail)?.[1];
const liveDetail = results.live.exit === null || !results.live.detail ? null : results.live.detail;

console.log(
  formatRulerLine(ruler, {
    phase: Number(valueAfter("--phase") ?? 0),
    tests: testCount === undefined ? null : Number(testCount),
    live: liveDetail,
  }),
);

if (!rulerOnly) {
  const report = gateReport(results);
  console.log(formatGateBlock(report, results));
  if (ruler.missing.length) console.log(`SOURCES NOT MEASURED: ${ruler.missing.join(", ")}`);

  // The ruler screen must be able to say what the last gate run measured, not guess it from prose.
  // A gate that never ran is stored as NOT-RUN so the screen cannot read it as a pass.
  writeFileSync(
    "docs/ledger/last-gate.json",
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        phase: Number(valueAfter("--phase") ?? 0),
        verdict: report.ok ? "GREEN" : "REFUSED",
        refused: report.failed,
        notRun: report.notRun,
        tests: testCount === undefined ? null : Number(testCount),
        live: results.live.exit === null ? null : results.live.detail || null,
        gates: results,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log("stamped docs/ledger/last-gate.json");
  process.exitCode = report.ok ? 0 : 1;
}
