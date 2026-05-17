import { describe, expect, it } from "vitest";
import {
  heuristicClassify,
  detectActionOrientedRequest,
  opportunisticClassify,
  needsMultiAgentMission,
} from "@/lib/admin-intent-classifier";
import { inferUltimateTool, wantsGenesis } from "@/lib/admin-tool-bridge";
import { ADMIN_SCENARIO_MATRIX } from "./admin-assistant-scenarios.matrix";
import { ADMIN_COMMANDS, listUltimateToolNames } from "@/lib/admin-capability-manifest";

describe("admin assistant scenario matrix (heuristic)", () => {
  const failures: string[] = [];

  for (const scenario of ADMIN_SCENARIO_MATRIX) {
    it(`classifies: ${scenario.message.slice(0, 50)}… → ${scenario.kind}`, () => {
      if (scenario.note === "action-fallback") {
        const routed =
          opportunisticClassify(scenario.message)?.kind === "agents" ||
          needsMultiAgentMission(scenario.message) ||
          detectActionOrientedRequest(scenario.message);
        expect(routed).toBe(true);
        return;
      }

      const result = heuristicClassify(scenario.message);

      if (!result) {
        if (scenario.kind === "conversation") {
          expect(detectActionOrientedRequest(scenario.message)).toBe(false);
          return;
        }
        failures.push(`NO_MATCH: "${scenario.message}" expected ${scenario.kind}`);
        expect(result, `no heuristic for: ${scenario.message}`).toBeTruthy();
        return;
      }

      expect(result.kind).toBe(scenario.kind);

      if (scenario.command) {
        expect(result.command || result.commandLine?.split(/\s+/)[0]).toBe(
          scenario.command
        );
      }
      if (scenario.toolName) {
        expect(result.toolName).toBe(scenario.toolName);
      }
    });
  }

  it("matrix has broad coverage", () => {
    expect(ADMIN_SCENARIO_MATRIX.length).toBeGreaterThanOrEqual(60);
    const kinds = new Set(ADMIN_SCENARIO_MATRIX.map((s) => s.kind));
    expect(kinds.has("command")).toBe(true);
    expect(kinds.has("agents")).toBe(true);
    expect(kinds.has("ultimate_tool")).toBe(true);
    expect(kinds.has("conversation")).toBe(true);
  });
});

describe("admin assistant resilience primitives", () => {
  it("every registered command name is a known executor command", () => {
    const executorCommands = [
      "add_key",
      "remove_key",
      "list_keys",
      "check_keys",
      "rate_limit",
      "send_notification",
      "show_stats",
      "clear_cache",
      "restart_service",
      "backup_db",
      "evolve",
      "help",
      "search",
      "read",
      "add_backup_key",
      "simulate_key_usage",
    ];
    for (const cmd of ADMIN_COMMANDS) {
      expect(executorCommands).toContain(cmd);
    }
  });

  it("ultimate tools are discoverable", () => {
    const names = listUltimateToolNames();
    expect(names).toContain("seo_analyze");
    expect(names).toContain("section_create");
    expect(names.length).toBeGreaterThan(10);
  });

  it("action-oriented requests are detected", () => {
    expect(detectActionOrientedRequest("حدّث أسعار الغرف")).toBe(true);
    expect(detectActionOrientedRequest("ازيك")).toBe(false);
  });

  it("inferUltimateTool covers speed and revenue", () => {
    expect(inferUltimateTool("حلّل سرعة الموقع")?.toolName).toBe("speed_analyze");
    expect(inferUltimateTool("حلّل الإيرادات")?.toolName).toBe("revenue_analyze");
  });

  it("genesis vs section create do not collide", () => {
    expect(wantsGenesis("كوّن موقع جديد")).toBe(true);
    expect(inferUltimateTool("أنشئ قسم جديد")?.toolName).toBe("section_create");
  });

  it("multi-agent still works without prefix", () => {
    expect(needsMultiAgentMission("راجع الموقع بالكامل وصلح الأخطاء")).toBe(true);
  });
});
