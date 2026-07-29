import { describe, expect, it } from "vitest";
import {
  buildCapabilityAuditReport,
  listAssistantCapabilities,
} from "@/lib/admin-assistant-capabilities";
import { TOOL_REGISTRY, validateToolParams } from "@/lib/agent-tools/tool-registry";
import { heuristicClassify } from "@/lib/admin-intent-classifier";

describe("unified assistant torture-suite foundation", () => {
  it("every registered tool has a capability contract and verification strategy", () => {
    const capabilities = listAssistantCapabilities();
    for (const toolName of Object.keys(TOOL_REGISTRY)) {
      const capability = capabilities.find((item) => item.toolName === toolName);
      expect(capability, toolName).toBeDefined();
      expect(capability!.verification.length, toolName).toBeGreaterThan(0);
      expect(capability!.evidenceExamples.length, toolName).toBeGreaterThan(0);
    }
  });

  it("non-low risk tools cannot bypass owner approval", () => {
    for (const [toolName, tool] of Object.entries(TOOL_REGISTRY)) {
      if (tool.riskLevel !== "low") {
        expect(tool.requiresApproval, toolName).toBe(true);
      }
    }
  });

  it("capability audit has no not-ready gaps", () => {
    const report = buildCapabilityAuditReport();
    expect(report.gaps).toEqual([]);
    expect(report.productionReady).toBe(true);
    expect(report.averageReadiness).toBeGreaterThanOrEqual(90);
    expect(report.averageTrust).toBeGreaterThanOrEqual(50);
    expect(report.verificationCoverage).toBe(100);
    expect(report.byOperationalTier.blocked).toBe(0);
    expect(report.byTestStatus.failed).toBe(0);
    expect(report.byTestStatus.passed + report.byTestStatus.protected).toBe(report.total);
  });

  it("every capability exposes operational readiness metadata", () => {
    const capabilities = listAssistantCapabilities();
    for (const capability of capabilities) {
      expect(capability.operationalTier, capability.id).toMatch(
        /^(autonomous|approval_required|blocked)$/
      );
      expect(capability.executionMode, capability.id).toMatch(/^(read_only|write|external|system)$/);
      expect(capability.readinessScore, capability.id).toBeGreaterThanOrEqual(0);
      expect(capability.readinessScore, capability.id).toBeLessThanOrEqual(100);
      expect(capability.trustScore, capability.id).toBeGreaterThan(0);
      expect(capability.trustScore, capability.id).toBeLessThanOrEqual(100);
      expect(capability.testStatus, capability.id).toMatch(/^(passed|protected|failed)$/);
      expect(capability.testSummary, capability.id).toBeTruthy();
    }
  });

  it("high-value owner requests classify into executable valid tool params", () => {
    const scenarios = [
      { message: "backup settings", toolName: "backup_create" },
      { message: "list all backups", toolName: "backup_list" },
      { message: "analyze SEO for the site", toolName: "seo_analyze" },
      { message: "show products", toolName: "product_list" },
      { message: "show revenue opportunities", toolName: "revenue_opportunities" },
      { message: "deep system health check", toolName: "system_health_check" },
      { message: "استخدم المتصفح واتعلم من أحدث أدوات AI agents", toolName: "browser_research" },
      { message: "ابحث فى الويب عن اسعار كونتر الميلامين فى مصر اليوم", toolName: "web_search" },
    ];

    for (const scenario of scenarios) {
      const intent = heuristicClassify(scenario.message);
      expect(intent?.toolName, scenario.message).toBe(scenario.toolName);
      expect(
        validateToolParams(intent!.toolName!, intent!.toolParams || {}).valid,
        scenario.message
      ).toBe(true);
    }
  });
});
