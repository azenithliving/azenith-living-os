// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { EXPLICIT, officeOf, sharedMachines, type CensusAtom } from "@/lib/ops/migration-map";

/**
 * The transfer ledger is the reference the program says to count from — «the ledger,
 * not the agent's memory». That only holds if the ledger cannot lie, so this guard
 * reads the generated file and checks it against the census and the map: one row per
 * atom, four states, no row for something that is not there, and no move claimed
 * without a proof line.
 */
type LedgerRow = { atom: string; kind: string; state: string; phase?: string; when?: string; proof?: string };

const censusPath = "docs/ledger/census.json";
const ledgerPath = "docs/ledger/transfers.json";
const census = existsSync(censusPath)
  ? (JSON.parse(readFileSync(censusPath, "utf8")) as { atoms: CensusAtom[] })
  : null;
const ledger = existsSync(ledgerPath)
  ? (JSON.parse(readFileSync(ledgerPath, "utf8")) as { states: string[]; rows: LedgerRow[] })
  : null;

describe("the transfer ledger", () => {
  it("is generated over every atom in the census, exactly once", () => {
    expect(census, "run: node scripts/ops-census.mjs").not.toBeNull();
    expect(ledger, "run: node scripts/ops-census.mjs").not.toBeNull();
    expect(ledger!.rows).toHaveLength(census!.atoms.length);
    const ids = ledger!.rows.map((r) => r.atom);
    expect(new Set(ids).size, "a repeated atom row means two states for one thing").toBe(ids.length);
    expect([...ids].sort()).toEqual([...census!.atoms.map((a) => a.id)].sort());
  });

  it("uses only the four agreed states", () => {
    expect(ledger!.states).toEqual(["not-moved", "moving", "moved", "erased"]);
    for (const row of ledger!.rows) expect(ledger!.states, row.atom).toContain(row.state);
  });

  it("names nothing the map cannot seat", () => {
    for (const row of ledger!.rows) {
      const atom = census!.atoms.find((a) => a.id === row.atom)!;
      expect(officeOf(atom), `${row.atom} has no office and no shared sign`).not.toBeNull();
    }
  });

  it("never lets the map claim a move the ledger does not", () => {
    const movedInMap = EXPLICIT.filter((e) => e.status === "moved").map((e) => e.id).sort();
    const movedInLedger = ledger!.rows.filter((r) => r.state === "moved").map((r) => r.atom).sort();
    expect(movedInLedger, "the two files must say the same thing about what moved").toEqual(movedInMap);
  });

  it("carries a proof line for every move it claims", () => {
    const claimed = ledger!.rows.filter((r) => r.state === "moved" || r.state === "erased");
    for (const row of claimed) {
      expect((row.proof ?? "").trim().length, `${row.atom} is claimed moved with no proof`).toBeGreaterThan(10);
      expect(row.when, `${row.atom} is claimed moved with no date`).toBeTruthy();
    }
  });

  it("counts what the fence says is machinery, so the owner sees the residue by number", () => {
    const shared = sharedMachines(census!.atoms);
    expect(shared.length).toBeGreaterThan(0);
    const states = ledger!.rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.state] = (acc[r.state] ?? 0) + 1;
      return acc;
    }, {});
    expect(states["not-moved"], JSON.stringify(states)).toBeGreaterThan(0);
  });
});
