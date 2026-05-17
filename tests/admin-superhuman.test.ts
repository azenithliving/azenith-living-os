import { describe, expect, it } from "vitest";
import { TOOL_REGISTRY } from "@/lib/agent-tools/tool-registry";
import {
  getCapabilityMaturityReport,
  buildCapabilityEvolutionProposals,
} from "@/lib/admin-capability-evolution";
import {
  matchLearnedPattern,
  listLearnedPatternCount,
} from "@/lib/admin-learned-patterns";
import { heuristicClassify } from "@/lib/admin-intent-classifier";

const STUB_RE = /not yet implemented/i;

describe("superhuman capability layer", () => {
  it("has zero stub handlers in the full registry", () => {
    const stubs = Object.entries(TOOL_REGISTRY).filter(([, t]) =>
      STUB_RE.test(String(t.handler))
    );
    expect(stubs.map(([n]) => n)).toEqual([]);
  });

  it("registers extended CRM, research, and restore tools", () => {
    const required = [
      "backup_restore",
      "lead_list",
      "lead_dossier_send",
      "room_update",
      "content_health_check",
      "product_list",
      "web_search",
      "revenue_opportunities",
    ];
    for (const name of required) {
      const tool = TOOL_REGISTRY[name];
      expect(tool, name).toBeDefined();
      expect(String(tool.handler)).not.toMatch(STUB_RE);
    }
    expect(Object.keys(TOOL_REGISTRY).length).toBeGreaterThanOrEqual(33);
  });

  it("maturity report shows sovereign-tier potential", () => {
    const report = getCapabilityMaturityReport();
    expect(report.toolsLive).toBeGreaterThanOrEqual(33);
    expect(report.toolsStub).toBe(0);
    expect(report.score).toBeGreaterThanOrEqual(70);
    expect(["advanced", "sovereign"]).toContain(report.tier);
  });

  it("evolution proposes evolve when stubs remain", () => {
    const report = getCapabilityMaturityReport();
    const proposals = buildCapabilityEvolutionProposals(report);
    if (report.toolsStub > 0) {
      expect(proposals.some((p) => p.intent.command === "evolve")).toBe(true);
    }
  });

  it("learned patterns match self-evolve and backup list", () => {
    expect(listLearnedPatternCount()).toBeGreaterThanOrEqual(10);
    const evolve = matchLearnedPattern("طوّر قدراتك ومهاراتك");
    expect(evolve?.command).toBe("evolve");
    const backups = heuristicClassify("اعرض النسخ الاحتياطية");
    expect(backups?.toolName).toBe("backup_list");
  });

  it("health intent routes to system_health_check via ultimate bridge", () => {
    const deep = heuristicClassify("فحص تقني عميق للنظام");
    expect(deep?.toolName).toBe("system_health_check");
  });
});
