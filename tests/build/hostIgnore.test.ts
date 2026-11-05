// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { isExcludedFromHostBuild, sourceLines } from "@/lib/build/host-ignore";

/**
 * The publish of 2026-11-05 failed on the host with «Can't resolve @/lib/build/ruler-view» while the
 * local build was green: `.vercelignore` carried a bare `build` line, and a bare name matches that
 * segment at ANY depth — so `lib/build` never reached the server. The gate is only a gate if it
 * builds the way the host builds, and the ignore file is only safe if something checks it.
 */
describe("the host ignore file", () => {
  it("catches a bare directory name that strips source at depth", () => {
    expect(isExcludedFromHostBuild(["build"], "lib/build/ruler-view.ts")).toBe(true);
    expect(isExcludedFromHostBuild(["docs"], "docs/ledger/census.json")).toBe(true);
  });

  it("lets an anchored pattern exclude only the root output", () => {
    expect(isExcludedFromHostBuild(["/build"], "lib/build/ruler-view.ts")).toBe(false);
    expect(isExcludedFromHostBuild(["/build"], "build/index.js")).toBe(true);
  });

  it("honours a negation that brings a subfolder back", () => {
    const rules = ["/docs/*", "!/docs/ledger"];
    expect(isExcludedFromHostBuild(rules, "docs/ledger/census.json")).toBe(false);
    expect(isExcludedFromHostBuild(rules, "docs/plan/خطة.md")).toBe(true);
  });

  it("still excludes by extension at any depth", () => {
    expect(isExcludedFromHostBuild(["*.test.ts"], "lib/build/ruler.test.ts")).toBe(true);
    expect(isExcludedFromHostBuild(["*.json"], "docs/ledger/census.json")).toBe(true);
  });

  it("keeps the paths the ruler needs inside the real ignore file", () => {
    const rules = sourceLines(readFileSync(".vercelignore", "utf8"));
    expect(isExcludedFromHostBuild(rules, "lib/build/ruler-view.ts")).toBe(false);
    expect(isExcludedFromHostBuild(rules, "docs/ledger/census.json")).toBe(false);
    expect(isExcludedFromHostBuild(rules, "docs/ledger/dead-map.json")).toBe(false);
    expect(isExcludedFromHostBuild(rules, "app/api/admin/ruler/route.ts")).toBe(false);
  });

  it("still keeps the things that must not ship", () => {
    const rules = sourceLines(readFileSync(".vercelignore", "utf8"));
    expect(isExcludedFromHostBuild(rules, "scratch/probe.mjs")).toBe(true);
    expect(isExcludedFromHostBuild(rules, ".env.local")).toBe(true);
    expect(isExcludedFromHostBuild(rules, "node_modules/next/package.json")).toBe(true);
  });
});
