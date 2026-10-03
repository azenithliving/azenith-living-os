// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The council closed 2026-10-03 on one measured finding: six of the thirteen pages of
 * the new house were shells carrying the sentence «سيُنقل المحتوى لاحقاً», while the
 * counting logic lived in another page. A shell is worse than a missing page because it
 * reads as finished work.
 *
 * This guard keeps two things true: no new-house page ships the transfer sentence again,
 * and the owner's overview address draws its numbers from the same module the agents
 * address draws from — one counter, not two that can disagree.
 */
function pagesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return pagesUnder(full);
    return entry === "page.tsx" ? [full] : [];
  });
}

const ROOT = "app/admin/v2";
const SHELL = /سيُنقل|على نظيف|فاضية/;
const CANVAS = /@\/components\/admin\/v2\/CommandCanvas/;

describe("the new house ships no shell", () => {
  it("scans every page of the new house", () => {
    // A guard that reads nothing passes vacuously.
    const found = pagesUnder(ROOT);
    expect(found.length, `found ${found.length} pages under ${ROOT}`).toBeGreaterThanOrEqual(13);
  });

  it("carries the transfer sentence nowhere", () => {
    const hits = pagesUnder(ROOT)
      .filter((f) => SHELL.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(/\\/g, "/"));
    expect(hits, hits.join("\n")).toEqual([]);
  });

  /**
   * The owner reads Arabic-Indic digits on his screens. Measured 2026-10-03: the studio
   * header carried «8 وكلاء» — a Western digit sitting inside Arabic copy, which is the
   * one defect a screenshot reveals and a type check never does.
   *
   * Comments and code are stripped first: «390 بكسل» in a docstring is not a screen.
   */
  it("writes the owner's numbers in Arabic digits", () => {
    const WESTERN_IN_ARABIC = /[\u0600-\u06FF]\s*[0-9]|[0-9]\s*[\u0600-\u06FF]/;
    const copyOnly = (src: string) =>
      src
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*|import)/.test(l))
        .join("\n")
        // Arabic-Indic digits are legal; the JSX attribute values and identifiers around
        // them are not copy, so a hit is only a hit when a Western digit touches Arabic.
        .replace(/[\u0660-\u0669]/g, "#");
    const hits = pagesUnder(ROOT)
      .filter((f) => WESTERN_IN_ARABIC.test(copyOnly(readFileSync(f, "utf8"))))
      .map((f) => f.replace(/\\/g, "/"));
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("the owner's overview address is the command canvas", () => {
  it("mounts the shared canvas at the root", () => {
    expect(CANVAS.test(readFileSync(join(ROOT, "page.tsx"), "utf8"))).toBe(true);
  });

  it("mounts the same canvas at the agents address", () => {
    expect(CANVAS.test(readFileSync(join(ROOT, "agents", "page.tsx"), "utf8"))).toBe(true);
  });

  it("counts the store from one module only", () => {
    // The pulse reading lives in lib/ops/command-canvas; a page that re-implements the
    // fetch trio would be a second counter of the same truth.
    const canvas = readFileSync("components/admin/v2/CommandCanvas.tsx", "utf8");
    expect(canvas).toContain("@/lib/ops/command-canvas");
    const rootPage = readFileSync(join(ROOT, "page.tsx"), "utf8");
    expect(rootPage).not.toContain("/api/admin/agents/approval-queue");
  });
});
