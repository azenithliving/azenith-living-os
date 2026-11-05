// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";

/**
 * The proof tooling must have exactly one home.
 *
 * Every measurement this project ever proved itself with sat in `scratch/`, untracked — and the
 * three that mattered (the publish waiter, the accessibility sweep, the phone-width live proof)
 * were one disk wipe from vanishing. M0 moved them into `scripts/instruments/`. This guard fails
 * if a copy reappears in scratch, because two copies of a measuring tool is how two different
 * numbers end up in two different reports.
 */

const PROMOTED = ["wait-publish.mjs", "measure-accessibility.mjs", "prove-snapshot-no-regression-390.mjs"];

describe("the promoted instruments", () => {
  it("live in scripts/instruments", () => {
    for (const name of PROMOTED) {
      expect(existsSync(`scripts/instruments/${name}`), name).toBe(true);
    }
  });

  it("are not left behind in scratch as a second copy", () => {
    if (!existsSync("scratch")) return;
    const leftovers = readdirSync("scratch").filter((name) => PROMOTED.includes(name));
    expect(leftovers).toEqual([]);
  });

  it("keep the gate command's own logic in the tested module, not in the script", () => {
    const cli = existsSync("scripts/gate.mjs") ? readFileSync("scripts/gate.mjs", "utf8") : "";
    expect(cli).toContain("../lib/build/gates.ts");
    expect(cli).toContain("../lib/build/ruler.ts");
    expect(cli).not.toMatch(/function parseVitestSummary/);
    expect(cli).not.toMatch(/function readRuler/);
  });
});
