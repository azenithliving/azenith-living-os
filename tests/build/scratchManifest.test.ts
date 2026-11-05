// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readScratchManifest } from "@/lib/build/scratch-manifest";

/**
 * 1563 measurement files sat in scratch/ untracked — the proof tooling itself was the thing most
 * likely to be lost. The manifest is not a backup of their contents; it is the record that they
 * existed, what they were named, and how big they were, so "nothing was forgotten" is a claim with
 * a file behind it.
 */

function workspace(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "manifest-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body, "utf8");
  }
  return root;
}

describe("readScratchManifest", () => {
  it("names every instrument it found and tallies it by extension", () => {
    const root = workspace({
      "measure-a.mjs": "console.log(1)",
      "prove-b.mjs": "console.log(22)",
      "nested/run-c.mjs": "console.log(333)",
      "a.out": "text",
      "b.png": "xxxx",
    });

    const manifest = readScratchManifest(root);

    expect(manifest.found).toBe(true);
    expect(manifest.count).toBe(5);
    expect(manifest.byExtension).toEqual({ mjs: 3, out: 1, png: 1 });
    expect(manifest.instruments).toBe(3);
    expect(manifest.names).toContain("nested/run-c.mjs");
    expect(manifest.totalBytes).toBeGreaterThan(0);
  });

  it("says the folder did not answer instead of reporting an empty manifest", () => {
    const manifest = readScratchManifest(join(tmpdir(), "definitely-not-here-42"));
    expect(manifest.found).toBe(false);
    expect(manifest.count).toBeNull();
    expect(manifest.reason).toContain("definitely-not-here");
  });

  it("counts an empty folder as zero files but still a folder that answered", () => {
    const root = workspace({});
    const manifest = readScratchManifest(root);
    expect(manifest.found).toBe(true);
    expect(manifest.count).toBe(0);
  });
});
