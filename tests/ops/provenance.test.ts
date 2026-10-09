// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  PROVENANCE_DESK_IDS,
  SITE_AUDIT_DESK,
  SWARM_DESK,
  VISITOR_AUDIT_DESK,
  WORLD_DESK,
  deskLabel,
  deskLineFor,
  deskNames,
  pickPrimaryDesk,
  provenanceEnvelope,
  readDesks,
} from "@/lib/ops/provenance";
import { CAPABILITY_LABELS } from "@/lib/ops/palette";

/**
 * A chat row is a record, not a sentence. Measured 2026-10-09 over the live table:
 * 636 agent rows carried a desk record, 224 carried an empty object — and three of the
 * empty ones (2026-10-07 00:21 → 00:30) had genuinely written page drafts under them.
 * These tests hold the difference open: a stated "nothing ran" and a missing record must
 * never again be the same shape.
 */

describe("the name a desk has on his screen", () => {
  it("uses the palette's Arabic command, not the id", () => {
    expect(deskLabel("ops_world")).toBe("ايزاي الشغل الفترة دي");
    expect(deskLabel("draft_list")).toBe("جرد المسودات المعلقة");
    expect(deskLabel("ops_world")).not.toContain("ops_world");
  });

  it("names the desks that are not commands he can type", () => {
    expect(deskLabel(SWARM_DESK)).toBe("سرب تعديل الصفحات");
    expect(deskLabel(SITE_AUDIT_DESK)).toBe("الفحص الشامل للموقع");
    expect(deskLabel(VISITOR_AUDIT_DESK)).toBe("فحص تجربة الزوار");
    expect(deskLabel(WORLD_DESK)).toBe("قراءة عالم الدار الحيّة");
  });

  it("leaves an unnamed desk unnamed instead of printing its machine name", () => {
    expect(deskLabel("system_health")).toBeNull();
    expect(deskLabel("")).toBeNull();
    expect(deskLabel(null)).toBeNull();
  });

  it("prints Arabic only, never a Latin identifier", () => {
    const lines = [
      ...Object.keys(CAPABILITY_LABELS).map((id) => deskLineFor({ via: "orchestrator", desks: [{ desk: id, ok: true }] })),
      deskLineFor({ via: "orchestrator", desks: [{ desk: SWARM_DESK, ok: true }] }),
    ];
    for (const line of lines) {
      expect(line).not.toBeNull();
      expect(line).not.toMatch(/[A-Za-z]/);
    }
  });

  /**
   * One fact, one owner: the palette owns the Arabic name of a command. The three desks
   * provenance names itself must never collide with a command id, or the same word would
   * mean two things on two surfaces.
   */
  it("owns only the desk names the palette does not", () => {
    expect(PROVENANCE_DESK_IDS).toEqual([SWARM_DESK, SITE_AUDIT_DESK, VISITOR_AUDIT_DESK, WORLD_DESK]);
    for (const id of PROVENANCE_DESK_IDS) {
      expect(CAPABILITY_LABELS[id]).toBeUndefined();
    }
  });

  it("drops a desk it cannot name rather than showing its id", () => {
    expect(deskNames([{ desk: "ops_rivals", ok: true }, { desk: "system_health", ok: true }])).toEqual([
      "قياس المنافسين",
    ]);
  });
});

describe("the envelope every write path stores", () => {
  it("says plainly that nothing ran, instead of leaving a blank", () => {
    expect(provenanceEnvelope("orchestrator", [])).toEqual({ via: "orchestrator", desks: [] });
  });

  it("keeps the keys the row readers already use", () => {
    expect(provenanceEnvelope("orchestrator", [{ desk: "ops_world", ok: true }])).toEqual({
      via: "orchestrator",
      desks: [{ desk: "ops_world", ok: true }],
      tool: "ops_world",
      success: true,
    });
  });

  it("answers for the row with a desk that succeeded, else the one attempted", () => {
    const mixed = provenanceEnvelope("orchestrator", [
      { desk: "seo_analyze", ok: false },
      { desk: SWARM_DESK, ok: true },
    ]);
    expect(mixed.tool).toBe(SWARM_DESK);
    expect(mixed.success).toBe(true);
    expect(pickPrimaryDesk([{ desk: "seo_analyze", ok: false }])).toEqual({ desk: "seo_analyze", ok: false });
    expect(pickPrimaryDesk([])).toBeNull();
  });

  it("records a failed desk as a failed desk — a try is not a deed", () => {
    expect(readDesks(provenanceEnvelope("messages-door", [{ desk: "backup_create", ok: false }]))).toEqual([
      { desk: "backup_create", ok: false },
    ]);
  });
});

describe("rows written before this record keep their meaning", () => {
  it("reads a lone tool key as one desk", () => {
    expect(readDesks({ tool: "ops_world", result: "…", data: {}, success: true })).toEqual([
      { desk: "ops_world", ok: true },
    ]);
    expect(readDesks({ tool: "ops_rivals", success: false })).toEqual([{ desk: "ops_rivals", ok: false }]);
  });

  /**
   * The honest half: the 224 historic `{}` rows — including the ones that really wrote a
   * draft — get NO line on his screen. Absence of a record is not evidence that nothing
   * ran, and the surface must not claim otherwise about rows it never witnessed.
   */
  it("says nothing about a row it has no record of", () => {
    for (const shape of [{}, null, undefined, { approval_id: "x" }, { proactive: true, issue: {} }, "nonsense"]) {
      expect(readDesks(shape)).toEqual([]);
      expect(deskLineFor(shape)).toBeNull();
    }
  });

  it("joins several desks into one Arabic line", () => {
    expect(
      deskLineFor({ desks: [{ desk: "ops_rivals", ok: true }, { desk: SWARM_DESK, ok: true }] })
    ).toBe("قياس المنافسين · سرب تعديل الصفحات");
  });
});

describe("every path that writes a row states itself", () => {
  const orchestrator = readFileSync("lib/agents/AgentOrchestrator.ts", "utf8");
  const messagesDoor = readFileSync("app/api/admin/agents/messages/route.ts", "utf8");
  const conversationsDoor = readFileSync("app/api/admin/agents/conversations/route.ts", "utf8");
  const proactiveCron = readFileSync("app/api/cron/ops-proactive/route.ts", "utf8");
  const brain = readFileSync("lib/admin-natural-brain.ts", "utf8");

  it("the four doors and the orchestrator all build an envelope", () => {
    expect(orchestrator).toContain('provenanceEnvelope("orchestrator", deskRuns)');
    expect(messagesDoor).toContain("provenanceEnvelope(");
    expect(conversationsDoor).toContain("provenanceEnvelope('conversations-door', [])");
    expect(proactiveCron).toContain("provenanceEnvelope(");
  });

  it("the leader's own shortcuts are counted as desks, not left blank", () => {
    expect(orchestrator).toContain(`desk: SITE_AUDIT_DESK`);
    expect(orchestrator).toContain(`desk: SWARM_DESK`);
    // This ternary is what made a swarm run read exactly like a shrug.
    expect(orchestrator).not.toMatch(/context:\s*toolResult\s*\?/);
  });

  it("the guard and the critic judge against the collected desks", () => {
    expect(orchestrator).toContain("pickPrimaryDesk(deskRuns)");
    expect(orchestrator).toContain("honestDeskClaims(response, desk)");
    expect(orchestrator).toContain("deskTruthFor(desk)");
    expect(orchestrator).toContain("{ executed: primary?.ok === true }");
  });

  it("the messages door hands its desk up from the brain", () => {
    expect(brain).toContain('tool: typeof result.command?.name === "string"');
    expect(messagesDoor).toContain("brain.tool ? [{ desk: brain.tool");
  });

  it("the proactive alert names the audit that found it", () => {
    expect(proactiveCron).toContain(`desk: VISITOR_AUDIT_DESK`);
  });

  it("a try is not a deed — the row's action flag obeys the outcome", () => {
    expect(orchestrator).toContain("action_taken: deskRuns.some((d) => d.ok)");
  });

  it("the writer says out loud what it stored", () => {
    expect(orchestrator).toContain("[provenance]");
    expect(messagesDoor).toContain("[provenance]");
  });
});

describe("his chat reads the record", () => {
  const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");

  it("the bubble renders the row's own desk list", () => {
    expect(panel).toContain("readDesks(message.context)");
    expect(panel).toContain("desks={deskRuns}");
    expect(panel).toContain("deskNames(runs)");
  });

  it("the id is never the label — the palette lookup is gone from the surface", () => {
    expect(panel).not.toContain("CAPABILITY_LABELS[toolName]");
  });
});
