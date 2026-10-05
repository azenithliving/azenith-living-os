// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildCapabilitySummaryForUser, ADMIN_COMMANDS, listUltimateToolNames } from "@/lib/admin-capability-manifest";
import { TOOL_REGISTRY } from "@/lib/agent-tools/tool-registry";
import { CAPABILITIES } from "@/lib/ops/capability-tiers";
import { arNum } from "@/lib/ops/metricLabels";

/**
 * The sentence the owner reads when no model answered.
 *
 * `buildCapabilitySummaryForUser` is the floor of the admin chat (`lib/admin-natural-brain.ts`
 * reaches for it twice: the ordinary conversation branch and the catch-all), so it is the text
 * that stands in for the swarm's intelligence when the keys are away. It was written as a
 * developer's inventory — «أقدر أنفّذ لك (29 أداة + 16 أمر)», then API, SEO, DB, PR, Vercel,
 * Genesis and a file path — which a man who reads only Arabic cannot act on, and which counted
 * stub tools as powers. Measured on the live store: the newest agent line in 10 of 10
 * conversations carries Latin letters, and one of those ten is this sentence.
 *
 * The counts here are the test's own oracle over the registry, not the function's output, so a
 * summary that quietly re-hardens a number fails instead of agreeing with itself.
 */
const totalTools = listUltimateToolNames().length;
const liveTools = Object.values(TOOL_REGISTRY).filter(
  (tool) => !/not yet implemented/i.test(String(tool.handler))
).length;

describe("the leader's floor sentence speaks his language", () => {
  const summary = buildCapabilitySummaryForUser();

  it("carries no Latin letter at all", () => {
    const hits = summary.match(/[A-Za-z]+/g) ?? [];
    expect(hits, hits.join(" ")).toEqual([]);
  });

  it("carries no Latin digit", () => {
    expect(summary.match(/[0-9]/g) ?? []).toEqual([]);
  });

  it("carries no machine separators inside the Arabic", () => {
    for (const mark of ["|", " + ", "://", "_"]) expect(summary, mark).not.toContain(mark);
  });

  it("names every capability the tiers ledger owns, in the ledger's own words", () => {
    for (const capability of CAPABILITIES) {
      expect(summary, capability.id).toContain(capability.label);
    }
  });

  it("counts its commands from the command list rather than a typed number", () => {
    expect(summary).toContain(arNum(ADMIN_COMMANDS.length));
  });

  it("counts the tools that actually answer, and says how many the register holds", () => {
    expect(summary).toContain(arNum(liveTools));
    expect(summary).toContain(arNum(totalTools));
    if (liveTools < totalTools) {
      // A stub presented as a power is the «لا أداة وهمية» brake, not a wording preference.
      expect(summary).toContain(arNum(totalTools - liveTools));
      expect(summary).toMatch(/ما بتشتغلش|لسه ما اشتغلتش|بستنى تنفيذ/);
    }
  });

  it("says out loud that the keyless floor is what answered", () => {
    expect(summary).toContain("صفر مفتاح");
    expect(summary).toContain("ما بيخترعش رد");
  });

  it("keeps the promise that a sensitive action still needs his word", () => {
    expect(summary).toContain("موافقتك");
  });
});

/**
 * Two rules for the same fact is how a panel starts disagreeing with a card. The maturity report
 * already separates live tools from stubs; the manifest must ask it, not re-derive the test.
 */
describe("one rule decides whether a tool is live", () => {
  it("the manifest owns the rule and the maturity report asks it", () => {
    const manifest = readFileSync("lib/admin-capability-manifest.ts", "utf8");
    const evolution = readFileSync("lib/admin-capability-evolution.ts", "utf8");
    expect(manifest).toContain("export function isLiveTool");
    expect(evolution).toContain("isLiveTool");
    expect(evolution).not.toContain("STUB_RE");
  });
});
