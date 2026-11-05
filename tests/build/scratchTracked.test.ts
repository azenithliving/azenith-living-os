// @vitest-environment node
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Measured 2026-11-05: a broad `git add scratch` swept 751 throwaway instruments into the published
 * commit — 65,063 lines of scripts, screenshots and archives — because the ignore file only excluded
 * the OUTPUT extensions while the folder itself stayed addable. The fix is the folder rule, and this
 * guard is what stops the next agent from re-opening the same hole.
 */
const trackedScratch = () =>
  execFileSync("git", ["ls-files", "scratch"], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

describe("the scratch folder", () => {
  it("is ignored as a folder, not only by output extension", () => {
    const ignore = readFileSync(".gitignore", "utf8").split(/\r?\n/);
    expect(ignore).toContain("scratch/");
  });

  it("carries no measurement output in the repository", () => {
    const outputs = trackedScratch().filter((f) => /\.(out|log|png|jpg|zip|txt|html|csv|html\.gz)$/.test(f));
    expect(outputs, `outputs committed: ${outputs.slice(0, 5).join(", ")}`).toEqual([]);
  });

  it("keeps the proof machinery in scripts/instruments instead", () => {
    const tools = execFileSync("git", ["ls-files", "scripts/instruments"], { encoding: "utf8" })
      .split(/\r?\n/)
      .filter((l) => l.endsWith(".mjs"));
    expect(tools.length).toBeGreaterThanOrEqual(6);
  });
});
