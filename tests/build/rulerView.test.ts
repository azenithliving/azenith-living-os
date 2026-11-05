// @vitest-environment node
import { describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildRulerView, loadRulerView } from "@/lib/build/ruler-view";
import type { Ruler } from "@/lib/build/ruler";

const ruler = (over: Partial<Ruler> = {}): Ruler => ({
  items: { total: 54, proven: 28, partial: 0, builtNoProof: 1, notBuilt: 23, unknown: 2 },
  atoms: { total: 537, moved: 29, moving: 6, notMoved: 494, noSurface: 7, erased: 1, withProof: 43 },
  doors: { all: 209, admin: 122, orphan: 75 },
  pages: { old: 17, oldLines: 5050, new: 15, newLines: 908 },
  crons: { doors: 2, scheduled: 2 },
  asOf: "2026-11-05",
  missing: [],
  ...over,
});

const rows = [
  { state: "moved", phase: "M1" },
  { state: "not-moved", phase: "M1" },
  { state: "not-moved", phase: "M10" },
];

/**
 * The screen the owner reads has to answer «وصلت فين» without a machine word on it. These tests pin
 * the two things that kept going wrong: a source that did not answer showing up as a reassuring
 * zero, and a phase with no surfaces seated reading as a phase with nothing left to do.
 */
describe("the ruler view", () => {
  it("answers with his digits only, in one line", () => {
    const view = buildRulerView({ phase: 1, ruler: ruler(), rows, dead: { doors: 75, furniture: 18, counts: { repair: 22, retire: 4, "owner-word": 0, "needs-verdict": 49 } } });
    expect(view.line).toContain("المرحلة ١ من ١٢");
    expect(/[0-9]/.test(view.line)).toBe(false);
    for (const phase of view.phases) expect(/[0-9]/.test(`${phase.atoms}${phase.moved}`)).toBe(false);
  });

  it("counts each phase's atoms and moves from the ledger, not from an impression", () => {
    const view = buildRulerView({ phase: 1, ruler: ruler(), rows, dead: null });
    const m1 = view.phases.find((p) => p.label === "الدفتر الحيّ")!;
    expect(m1.atoms).toBe("٢");
    expect(m1.moved).toBe("١");
    const m10 = view.phases.find((p) => p.label === "السرب كامل الدائرة")!;
    expect(m10.atoms).toBe("١");
  });

  it("says a phase with no seated surface is a facts phase, not a finished one", () => {
    const view = buildRulerView({ phase: 1, ruler: ruler(), rows, dead: null });
    const m2 = view.phases.find((p) => p.atoms === "٠")!;
    expect(m2.note, "a measured zero still needs its sentence").toBeTruthy();
    expect(m2.note).toContain("حقيقة");
  });

  it("names a source that did not answer instead of printing a zero for it", () => {
    const view = buildRulerView({
      phase: 1,
      ruler: ruler({ items: null, missing: ["masterList"] }),
      rows,
      dead: null,
    });
    expect(view.missing).toContain("القائمة الجامعة");
    expect(view.line).toContain("ما اتقارش");
    expect(view.line).not.toContain("البند ٠ من");
  });

  it("refuses to invent the dead map when the instrument never ran", () => {
    const view = buildRulerView({ phase: 1, ruler: ruler(), rows, dead: null });
    expect(view.deadLine).toContain("ما اتقارش");
    expect(view.deadLine).not.toMatch(/باب يتيم ٠/);
  });

  it("loads the twelve phases from the ledger files and names the source that did not answer", () => {
    const root = mkdtempSync(join(tmpdir(), "ruler-view-"));
    mkdirSync(join(root, "docs/ledger"), { recursive: true });
    writeFileSync(
      join(root, "docs/ledger/transfers.json"),
      JSON.stringify({ generatedAt: "2026-11-05T00:00:00.000Z", counts: { moved: 1, notMoved: 1 }, rows: [{ atom: "a", state: "moved", phase: "M1" }, { atom: "b", state: "not-moved", phase: "M10" }] }),
    );
    writeFileSync(
      join(root, "docs/ledger/census.json"),
      JSON.stringify({ generatedAt: "2026-11-05T00:00:00.000Z", counts: { orphanDoors: 75, allDoors: 209, adminDoors: 122, crons: 2 } }),
    );
    writeFileSync(
      join(root, "docs/ledger/dead-map.json"),
      JSON.stringify({ doors: 75, furniture: 18, counts: { repair: 22, retire: 4, "owner-word": 0, "needs-verdict": 49 } }),
    );
    writeFileSync(join(root, "docs/ledger/last-gate.json"), JSON.stringify({ generatedAt: "2026-11-05T00:00:00.000Z", tests: 2512, live: "ردّ صفر" }));

    const view = loadRulerView({ ledgerDir: join(root, "docs/ledger"), masterListPath: join(root, "missing.md"), phase: 1 });
    expect(view.phases).toHaveLength(12);
    expect(view.line).toContain("المرحلة ١ من ١٢");
    expect(view.line).toContain("٢٥١٢");
    expect(view.deadLine).toContain("٧٥ باب يتيم");
    expect(view.missing).toContain("القائمة الجامعة");
  });

  it("shows the silent-refusal count from the scan file", () => {
    const root = mkdtempSync(join(tmpdir(), "ruler-view-"));
    mkdirSync(join(root, "docs/ledger"), { recursive: true });
    writeFileSync(
      join(root, "docs/ledger/refusal-scan.json"),
      JSON.stringify({ measuredAt: "2026-11-05T00:00:00.000Z", total: 213, line: "رفض صامت: ٢١٣ اسم في الكود ما لوش ردّ من المخزن" }),
    );
    const view = loadRulerView({ ledgerDir: join(root, "docs/ledger"), masterListPath: join(root, "missing.md"), phase: 3 });
    expect(view.refusalLine).toContain("رفض صامت");
    expect(/[0-9]/.test(view.refusalLine)).toBe(false);
  });

  it("says the refusal scan is not measured when the file is absent", () => {
    const root = mkdtempSync(join(tmpdir(), "ruler-view-"));
    mkdirSync(join(root, "docs/ledger"), { recursive: true });
    const view = loadRulerView({ ledgerDir: join(root, "docs/ledger"), masterListPath: join(root, "missing.md"), phase: 3 });
    expect(view.refusalLine).toContain("ما اتقارش");
  });

  it("names a refusal scan older than the column map instead of presenting it as now", () => {
    const root = mkdtempSync(join(tmpdir(), "ruler-view-"));
    mkdirSync(join(root, "docs/ledger"), { recursive: true });
    writeFileSync(join(root, "docs/ledger/record-columns.json"), JSON.stringify({ measuredAt: "2026-11-05T00:00:00.000Z", tables: {} }));
    writeFileSync(
      join(root, "docs/ledger/refusal-scan.json"),
      JSON.stringify({ measuredAt: "2026-10-01T00:00:00.000Z", total: 4, line: "رفض صامت: ٤ اسم في الكود ما لوش ردّ من المخزن" }),
    );
    const view = loadRulerView({ ledgerDir: join(root, "docs/ledger"), masterListPath: join(root, "missing.md"), phase: 3 });
    expect(view.refusalLine).toContain("لقياس قديم");
  });

  it("takes the phase from the last gate run when nobody passes one", () => {
    const root = mkdtempSync(join(tmpdir(), "ruler-view-"));
    mkdirSync(join(root, "docs/ledger"), { recursive: true });
    writeFileSync(
      join(root, "docs/ledger/last-gate.json"),
      JSON.stringify({ generatedAt: "2026-11-05T00:00:00.000Z", phase: 3, tests: 10, live: "ردّ صفر" }),
    );
    const view = loadRulerView({ ledgerDir: join(root, "docs/ledger"), masterListPath: join(root, "missing.md") });
    expect(view.line).toContain("المرحلة ٣ من ١٢");
  });

  it("says the gate result is not measured when the gate file is absent", () => {
    const root = mkdtempSync(join(tmpdir(), "ruler-view-"));
    mkdirSync(join(root, "docs/ledger"), { recursive: true });
    const view = loadRulerView({ ledgerDir: join(root, "docs/ledger"), masterListPath: join(root, "missing.md"), phase: 1 });
    expect(view.missing).toContain("نتيجة البوابات");
    expect(view.deadLine).toContain("ما اتقارش");
    expect(view.line).not.toMatch(/الاختبارات ٠/);
  });
});
