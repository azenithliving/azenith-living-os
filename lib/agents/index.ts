/**
 * Agents Index - Qayyim Swarm only
 * PRIMEAgent completely replaced by Qayyim Swarm
 */

export { CoderAgent, coderAgent } from "./CoderAgent";
export { SecurityAgent, securityAgent } from "./SecurityAgent";
export { AnalystAgent, analystAgent } from "./AnalystAgent";
export { OpsAgent, opsAgent } from "./OpsAgent";

// Qayyim Swarm (primary)
export {
  QayyimCoreAgent, qayyimCoreAgent,
  QayyimContentAgent, qayyimContentAgent,
  QayyimVisualAgent, qayyimVisualAgent,
  QayyimSeoAgent, qayyimSeoAgent,
  QayyimUxAgent, qayyimUxAgent,
  QayyimAnalyticsAgent, qayyimAnalyticsAgent,
  QayyimDevAgent, qayyimDevAgent,
  QayyimQaAgent, qayyimQaAgent,
  MasterOrchestrator, masterOrchestrator,
} from "@/lib/qayyim";

export { agentOrchestrator } from "./AgentOrchestrator";

export type { CoderTask, CoderResult } from "./CoderAgent";
export type { SecurityTask, SecurityResult, Vulnerability } from "./SecurityAgent";
export type { AnalystTask, AnalysisResult } from "./AnalystAgent";
export type { OpsTask, OpsResult, HealthStatus } from "./OpsAgent";
export type { QayyimTask, QayyimResult, QayyimAgentCapabilities } from "@/lib/qayyim/QayyimAgentBase";
export type { AgentMessage, AgentOrchestratorResult, AgentType } from "./AgentOrchestrator";
