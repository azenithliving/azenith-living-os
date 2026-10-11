// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { renderWorldDigest, type WorldModel } from "@/lib/ops/world-model";
import { ownerVoice } from "@/lib/ops/owner-voice";
import { buildInboxes } from "@/lib/ops/inboxes";

/**
 * The glyphs that reorder his lines.
 *
 * Counted on the published owner screens 2026-10-11 (scratch/census-bidi-lines.mjs): 27 lines carry an
 * operator, 9 carry an arrow, 6 a nested bracket, 22 a Latin word the pass could not name. The arrows
 * are the cheapest win because two of them are written by this repository itself — the world digest's
 * date range and the orchestrator's section list — and an arrow between two Arabic runs is exactly the
 * character the bidi renderer uses to move the whole clause.
 */
function world(partial: Partial<WorldModel> = {}): WorldModel {
  return {
    generatedAt: "2026-10-11T06:00:00.000Z",
    companyId: null,
    window: { start: "2026-07-08", end: "2026-10-06" },
    revenue: null,
    items: null,
    catalog: null,
    visitors: null,
    goals: null,
    openProposals: null,
    openSuggestions: null,
    customerVoice: null,
    season: {},
    coverage: [],
    gaps: [],
    ...partial,
  } as WorldModel;
}

describe("the world digest", () => {
  it("states its window in his words, not with an arrow", () => {
    const line = renderWorldDigest(world({})).split("\n")[0];
    expect(line).toContain("من");
    expect(line).toContain("إلى");
    expect(line).not.toContain("→");
    expect(line).toContain("2026-07-08");
  });
});

describe("the orchestrator's section list", () => {
  const source = readFileSync("lib/ops/orchestrator/MasterOrchestrator.ts", "utf8");

  it("names the section and the employee instead of printing keys welded by an arrow", () => {
    expect(source).not.toContain("← ${");
    expect(source).toContain("agentLabel(section.agentKey)");
    expect(source).toContain("draftTypeLabel(section.sectionKey)");
  });
});

describe("the voice pass on a stray arrow", () => {  it("reads an arrow between two dates as the word it means", () => {
    expect(ownerVoice("نافذة 2026-07-08 → 2026-10-06")).toContain("إلى");
    expect(ownerVoice("نافذة 2026-07-08 → 2026-10-06")).not.toContain("→");
  });

  it("turns a left arrow into a plain dash", () => {
    expect(ownerVoice("• **gallery** ← visual")).not.toContain("←");
  });

  /**
   * A markdown table is split on the pipe by the renderer after this pass runs — eating the pipe would
   * turn every table in his chat into one long line.
   */
  it("leaves a table's pipes alone", () => {
    const row = "| القسم | الحالة |";
    expect(ownerVoice(row)).toBe(row);
  });
});

/**
 * The cockpit card's one-line preview is composed from a stored row, so it carries whatever that row
 * holds: the last arrow measured on his screens (2026-10-11) was a date range in a teaser written
 * before the digest stopped using one.
 */
describe("the cockpit's inbox teaser", () => {
  it("speaks the row it is previewing", () => {
    const boxes = buildInboxes({
      keys: ["ops-lead"],
      conversations: [{ id: "c1", title: "محادثة مع ops-lead", participants: ["ops-lead"] }],
      unreadRows: [],
      lastRows: [{ conversation_id: "c1", content: "**عالم الدار الآن** — نافذة 2026-07-12 → 2026-10-10" }],
      saturated: false,
    });
    expect(boxes["ops-lead"].teaser).toContain("إلى");
    expect(boxes["ops-lead"].teaser).not.toContain("→");
  });
});
