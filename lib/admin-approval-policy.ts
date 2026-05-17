import type { ClassifiedIntent } from "./admin-intent-types";
import { getTool } from "./agent-tools/tool-registry";

/** Actions that run immediately without owner approval. */
const AUTO_COMMANDS = new Set([
  "list_keys",
  "check_keys",
  "show_stats",
  "help",
  "search",
  "read",
]);

export function requiresOwnerApproval(intent: ClassifiedIntent): boolean {
  switch (intent.kind) {
    case "agents":
    case "genesis":
      return true;
    case "command": {
      const cmd = intent.command || intent.commandLine?.split(/\s+/)[0] || "";
      return !AUTO_COMMANDS.has(cmd);
    }
    case "ultimate_tool": {
      const tool = intent.toolName ? getTool(intent.toolName) : undefined;
      return tool?.requiresApproval === true || tool?.riskLevel !== "low";
    }
    case "architect":
      return intent.architectAction === "createAutomationRule";
    case "analytics":
    case "health":
    case "conversation":
      return false;
    default:
      return true;
  }
}

export function riskLevelForIntent(intent: ClassifiedIntent): "low" | "medium" | "high" | "critical" {
  if (intent.kind === "genesis" || intent.kind === "agents") return "high";
  if (intent.kind === "command") {
    const cmd = intent.command || "";
    if (["remove_key", "backup_db", "restart_service"].includes(cmd)) return "critical";
    if (["add_key", "clear_cache", "evolve"].includes(cmd)) return "high";
    return "medium";
  }
  if (intent.kind === "ultimate_tool") {
    const tool = intent.toolName ? getTool(intent.toolName) : undefined;
    if (tool?.riskLevel === "destructive") return "critical";
    if (tool?.riskLevel === "medium") return "high";
    return "medium";
  }
  return "medium";
}
