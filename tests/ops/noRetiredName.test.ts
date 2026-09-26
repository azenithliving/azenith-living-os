// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  if (!statSync(dir).isDirectory()) return [];
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return full.includes("vanguard") ? [] : files(full);
    return /\.(ts|tsx)$/.test(full) && !full.includes(".test.") ? [full] : [];
  });
}

/**
 * P7 retires the product name completely: the swarm is «سرب أزينث», its leader is a
 * job title, and its members are roles. The one place the old name may still be
 * written is `lib/ops/identity.ts`, which owns the mapping from the retired key to
 * the live one — that file is the migration's dictionary, not a surface.
 */
describe("the retired name is gone from shipped code", () => {
  for (const dir of ["app", "components", "lib"]) {
    it(`${dir} carries no retired brand`, () => {
      // A guard that scans nothing passes vacuously, so the scan itself is asserted.
      expect(files(dir).length, `${dir} was not walked`).toBeGreaterThan(10);
      const hits = files(dir)
        .filter((f) => !f.endsWith(join("lib", "ops", "identity.ts")))
        .filter((f) => readFileSync(f, "utf8").includes("قيّم الدار"));
      expect(hits, hits.join("\n")).toEqual([]);
    });
  }
});
