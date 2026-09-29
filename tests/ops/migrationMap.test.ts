// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { OFFICES, unassignedAtoms, officeOf, type CensusAtom } from "@/lib/ops/migration-map";

/**
 * The owner's test is «I want to see that not one nail was forgotten». That cannot
 * rest on an agent's memory, so it rests on this file: the census is generated from
 * the repository, every atom must resolve to an office, and the residue is printed
 * by name when it does not. A forgotten atom is a red test, not a quiet gap.
 */
const censusPath = "docs/ledger/census.json";
const census = existsSync(censusPath)
  ? (JSON.parse(readFileSync(censusPath, "utf8")) as { atoms: CensusAtom[] })
  : null;

describe("every atom in the census has an office", () => {
  it("the census exists and is not vacuous", () => {
    expect(census, "run: node scripts/ops-census.mjs").not.toBeNull();
    expect(census!.atoms.length).toBeGreaterThan(200);
  });

  it("names an office for every page, door, component and swarm file", () => {
    const loose = unassignedAtoms(census!.atoms);
    const byKind = loose.reduce<Record<string, number>>((acc, a) => {
      acc[a.kind] = (acc[a.kind] ?? 0) + 1;
      return acc;
    }, {});
    expect(loose.map((a) => `${a.kind} ${a.id}`).slice(0, 40), JSON.stringify(byKind)).toEqual([]);
  });

  it("seats every office with at least one thing", () => {
    for (const office of OFFICES) {
      const residents = census!.atoms.filter((a) => officeOf(a)?.office === office.id);
      expect(residents.length, `${office.id} is an empty office`).toBeGreaterThan(0);
    }
  });

  it("never seats the shared machines inside an office", () => {
    // A swallowed machine stops every employee, so it is asserted, not remembered.
    const forbidden = ["lib/vanguard", "lib/rate-limit", "utils/supabase"];
    for (const atom of census!.atoms) {
      for (const path of forbidden) {
        expect(atom.id.startsWith(path), atom.id).toBe(false);
      }
    }
  });
});
