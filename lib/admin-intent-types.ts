export type IntentKind =
  | "command"
  | "agents"
  | "architect"
  | "analytics"
  | "health"
  | "ultimate_tool"
  | "genesis"
  | "conversation";

export interface ClassifiedIntent {
  kind: IntentKind;
  command?: string;
  commandLine?: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
  architectAction?: "updateSiteSetting" | "createAutomationRule";
  architectParams?: Record<string, unknown>;
  analyticsDays?: 7 | 30 | 90;
  confidence: number;
  reasoning?: string;
}
