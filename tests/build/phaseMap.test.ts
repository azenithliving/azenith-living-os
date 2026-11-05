// @vitest-environment node
import { describe, it, expect } from "vitest";

import { OFFICES, SHARED_OFFICE } from "@/lib/ops/migration-map";
import {
  OFFICE_PHASES,
  PHASES,
  formatPhaseLine,
  phaseOfAtom,
  phaseOfOffice,
  phaseTally,
} from "@/lib/build/phase-map";

/**
 * M1's promise is that an agent can answer «فين» in sixty seconds without re-planning the project.
 * That only holds if the phase of an atom has ONE owner. The office map already seats all 532 atoms,
 * so the phase is derived from the office — never hand-written per row, which is what produced the
 * fourteen spellings («P6», «cockpit-transfer-1», «colour-1») found in the ledger on 2026-11-05.
 */
describe("the phase map", () => {
  it("declares exactly the twelve phases the contract fixes, in order", () => {
    expect(PHASES.map((p) => p.id)).toEqual([
      "M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11",
    ]);
  });

  it("names every phase in his Arabic, with no machine word in the label", () => {
    for (const phase of PHASES) {
      expect(/[A-Za-z]/.test(phase.label), `${phase.id} label carries Latin letters`).toBe(false);
      expect(phase.label.trim().length, `${phase.id} has no label`).toBeGreaterThan(2);
    }
  });

  it("seats every declared office in one of the twelve phases", () => {
    const ids = new Set(PHASES.map((p) => p.id));
    for (const office of OFFICES) {
      const phase = phaseOfOffice(office.id);
      expect(phase, `office ${office.id} has no phase`).toBeTruthy();
      expect(ids.has(phase as string), `office ${office.id} seats in unknown phase ${phase}`).toBe(true);
    }
    expect(phaseOfOffice(SHARED_OFFICE)).toBeTruthy();
  });

  it("refuses to invent a phase for an office the table never heard of", () => {
    // A default would silently move atoms into a phase nobody chose.
    expect(phaseOfOffice("office-nobody-declared")).toBeNull();
  });

  it("keeps the table and the derived answer the same fact", () => {
    for (const [office, phase] of Object.entries(OFFICE_PHASES)) {
      expect(phaseOfOffice(office), office).toBe(phase);
    }
  });

  it("answers the phase of an atom from the office that already owns it", () => {
    const atom = { kind: "old-page", id: "app/admin/v2/owner-dashboard/page.tsx" };
    expect(phaseOfAtom(atom)).toBe(phaseOfOffice("decision-desk"));
  });

  it("counts what it cannot seat instead of dropping it", () => {
    const tally = phaseTally([
      { kind: "old-page", id: "app/admin/v2/owner-dashboard/page.tsx" },
      { kind: "root-lib", id: "packages/nobody/points-here.ts" },
    ]);
    expect(tally.unseated).toEqual(["packages/nobody/points-here.ts"]);
    expect(tally.seated).toBe(1);
    expect(tally.total).toBe(2);
  });

  it("prints the phase answer in his digits and says what is not measured", () => {
    const line = formatPhaseLine({
      phase: "M1",
      tally: phaseTally([{ kind: "old-page", id: "app/admin/v2/owner-dashboard/page.tsx" }]),
    });
    expect(line).toContain("المرحلة");
    expect(/[0-9]/.test(line)).toBe(false);

    const starved = formatPhaseLine({
      phase: "M1",
      tally: phaseTally([{ kind: "root-lib", id: "packages/nobody/points-here.ts" }]),
    });
    expect(starved).toContain("ما اتقارش");
    expect(starved).not.toMatch(/فاضل ٠/);
  });
});
