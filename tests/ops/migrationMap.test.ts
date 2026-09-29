// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
  OFFICES,
  SHARED_OFFICE,
  EXPLICIT,
  officeOf,
  sharedMachines,
  unassignedAtoms,
  type CensusAtom,
} from "@/lib/ops/migration-map";

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
    // A swallowed machine stops every employee. The fence counts them so they are
    // never forgotten, and the sign says they belong to no single office.
    const forbidden = ["lib/vanguard", "lib/rate-limit", "utils/supabase"];
    for (const atom of census!.atoms) {
      if (!forbidden.some((path) => atom.id.startsWith(path))) continue;
      expect(officeOf(atom)?.office, atom.id).toBe(SHARED_OFFICE);
    }
    const seated = sharedMachines(census!.atoms);
    expect(seated.length, "the fence counts no shared machinery at all").toBeGreaterThan(0);
    expect(OFFICES.some((o) => o.id === SHARED_OFFICE), "shared is not an office").toBe(false);
    // The swallow test: exactly the library files one surface calls are allowed to be
    // seated, and the list is short on purpose. A new one is a decision, not a default.
    const libSeated = census!.atoms
      .filter((a) => /^lib\/[^/]+\.ts$/.test(a.id) && officeOf(a)?.office !== SHARED_OFFICE)
      .map((a) => a.id)
      .sort();
    expect(libSeated, JSON.stringify(libSeated)).toEqual(["lib/lead-insights.ts", "lib/leads-delete-guard.ts"]);
  });

  it("counts the doors and library files the first fence left outside the wall", () => {
    const kinds = census!.atoms.reduce<Record<string, number>>((acc, a) => {
      acc[a.kind] = (acc[a.kind] ?? 0) + 1;
      return acc;
    }, {});
    expect(kinds["outside-door"], "doors outside /api/admin that an admin surface calls").toBeGreaterThan(0);
    expect(kinds["root-lib"], "library files an admin surface imports").toBeGreaterThan(0);
    // Every one of them resolves — a counted atom with no sign is the forgotten nail.
    expect(unassignedAtoms(census!.atoms).map((a) => a.id)).toEqual([]);
  });
});

/**
 * The phantom CRM, asserted so it cannot quietly become «we thought it worked».
 * Six doors answer on the published site, five of them fail, and the three customer
 * tables their code writes to do not exist in the database — measured tonight by
 * `scripts/ops-customer-systems-census.mjs`. They are counted, signed, and waiting
 * for a verdict; they are not deleted and not trusted.
 */
describe("the orphan doors and the phantom customer pipeline", () => {
  const atoms = census ? census.atoms : [];

  it("counts the doors no admin surface calls", () => {
    const orphans = atoms.filter((a) => a.kind === "orphan-door");
    expect(orphans.length, "the fence stopped counting orphan doors").toBeGreaterThan(50);
    expect(unassignedAtoms(orphans)).toEqual([]);
  });

  it("holds the vanguard pipeline as a verdict we have not made yet", () => {
    for (const id of [
      "app/api/vanguard/automation/tasks/route.ts",
      "app/api/vanguard/automation/triggers/route.ts",
      "app/api/vanguard/automation/workflows/route.ts",
      "app/api/vanguard/automation/routing/route.ts",
      "app/api/vanguard/automation/notifications/route.ts",
      "lib/agents/VanguardAgent.ts",
    ]) {
      const row = EXPLICIT.find((e) => e.id === id);
      expect(row, `${id} vanished from the map`).toBeTruthy();
      expect(row!.status, `${id} was given a home without a dossier`).toBe("needs-verdict");
      expect(row!.office).toBe("sales-office");
    }
  });
});
