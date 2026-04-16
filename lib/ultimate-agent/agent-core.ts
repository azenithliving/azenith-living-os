/**
 * Ultimate Agent Core - Simplified DeepSeek Integration
 *
 * Uses DeepSeek LLM for Egyptian Arabic understanding and command execution.
 */

import { askDeepSeek } from "@/lib/ai-orchestrator";
import { updateSiteSetting, createAutomationRule, getAnalyticsReport, getSystemHealth } from "@/lib/architect-tools";
import { storeMemory, searchMemories, getUserPreference, getUserPreferences, storeUserPreference, getActiveGoals, createGoal, MemoryEntry, MemoryFilters } from "./memory-store";
import { classifyRisk, validateAction, createApprovalRequest, approveRequest, rejectRequest, getPendingApprovals, getSecurityStats, AgentAction } from "./security-manager";
import { getMetricsSnapshot, analyzeTrend, detectAnomalies, generateOpportunities, generateStrategicRecommendations, runWhatIfScenario, predictResourceDepletion } from "./predictive-engine";
import { executeAction, executeBatch, executeCodeSuggestion, ExecutionResult } from "./executor-omnipotent";
import { generateSystemSnapshot } from "@/lib/discovery-engine";

/**
 * THE GREAT FOUNDING PROMPT - Agent DNA
 */
export const SYSTEM_PROMPT = `أنت مساعد ذكي لمدير موقع "أزينث للتصميم الداخلي" (Azenith Living). المستخدم يتحدث بالعامية المصرية.

مهمتك:
1. رد برد ودي ولطيف بالعامية المصرية
2. افهم إذا كان المستخدم يطلب:
   - تغيير لون/إعداد (updateSiteSetting)
   - إنشاء قاعدة أتمتة (createAutomationRule)
   - تقرير زوار/إحصائيات (getAnalytics)
   - فحص حالة النظام (getSystemHealth)
   - أو مجرد تحية/سؤال عام (null)

أخرج JSON بالصيغة:
{ "action": "updateSiteSetting|createAutomationRule|getAnalytics|getSystemHealth|null", "params": {}, "reply": "ردك الطبيعي بالعامية المصرية" }

Examples:
- "اهلا" → action: null, reply: "أهلاً بك، نورت! إيه اللي أقدر أساعدك فيه؟"
- "غير لون الأزرار للذهبي" → action: "updateSiteSetting", params: {key:"theme", value:{primaryColor:"#C5A059"}}, reply: "تمام! غيرت لون الأزرار للذهبي ✨"
- "كم عدد زوار اليوم؟" → action: "getAnalytics", params: {days:1}, reply: "عدد زوار اليوم 150 زائر 📊"
- "أنشئ قاعدة ترحيب" → action: "createAutomationRule", params: {name:"ترحيب", trigger:"page_visit", actions:[{type:"notification"}]}, reply: "تم إنشاء قاعدة الترحيب! 👋"`;

// Agent configuration
export interface AgentConfig {
  name: string;
  autoExecuteNormal: boolean;
  autoExecuteInfo: boolean;
  requireApprovalFor: string[];
  checkIntervalMinutes: number;
  maxDailyActions: number;
  learningEnabled: boolean;
  proactiveMode: boolean;
  notificationChannels: string[];
}

export interface AgentStatus {
  isActive: boolean;
  lastCheck: Date;
  nextCheck: Date;
  pendingApprovals: number;
  actionsToday: number;
  anomaliesDetected: number;
  goalsActive: number;
  mode: "active" | "paused" | "maintenance";
}

export interface ActionPlan {
  id: string;
  title: string;
  description: string;
  actions: Array<{
    type: string;
    payload: Record<string, unknown>;
    reason: string;
    priority: string;
  }>;
  expectedOutcome: string;
  requiresApproval: boolean;
  riskLevel: string;
  autoExecute: boolean;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
  actionTaken?: string;
  requiresApproval?: boolean;
  suggestions?: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  name: "Azenith Ultimate Agent",
  autoExecuteNormal: true,
  autoExecuteInfo: true,
  requireApprovalFor: ["critical", "forbidden"],
  checkIntervalMinutes: 60,
  maxDailyActions: 100,
  learningEnabled: true,
  proactiveMode: true,
  notificationChannels: ["telegram", "email"],
};

let currentConfig: AgentConfig = { ...DEFAULT_CONFIG };

let agentStatus: AgentStatus = {
  isActive: true,
  lastCheck: new Date(),
  nextCheck: new Date(Date.now() + 60 * 60 * 1000),
  pendingApprovals: 0,
  actionsToday: 0,
  anomaliesDetected: 0,
  goalsActive: 0,
  mode: "active",
};

export async function initializeAgent(config?: Partial<AgentConfig>): Promise<{
  success: boolean;
  message: string;
  status: AgentStatus;
}> {
  if (config) {
    currentConfig = { ...currentConfig, ...config };
  }

  const { success, requests } = await getPendingApprovals();
  if (success && requests) {
    agentStatus.pendingApprovals = requests.length;
  }

  const { success: goalsSuccess, goals } = await getActiveGoals();
  if (goalsSuccess && goals) {
    agentStatus.goalsActive = goals.length;
  }

  await storeMemory({
    type: "decision",
    category: "agent_initialization",
    content: `Ultimate Agent initialized with ${currentConfig.proactiveMode ? "proactive" : "passive"} mode`,
    priority: "high",
    context: { config: currentConfig },
  });

  return {
    success: true,
    message: `Ultimate Agent "${currentConfig.name}" initialized successfully`,
    status: agentStatus,
  };
}

export function getAgentConfig(): AgentConfig {
  return { ...currentConfig };
}

export async function updateAgentConfig(updates: Partial<AgentConfig>): Promise<{
  success: boolean;
  message: string;
}> {
  currentConfig = { ...currentConfig, ...updates };

  await storeMemory({
    type: "decision",
    category: "config_update",
    content: `Agent configuration updated`,
    priority: "normal",
    context: { updates },
  });

  return {
    success: true,
    message: "Configuration updated successfully",
  };
}

export async function executeCommand(
  command: string,
  context?: Record<string, unknown>
): Promise<CommandResult> {
  try {
    const agent = new UltimateAgent();
    const result = await agent.processCommand(command, "system");
    return {
      success: true,
      message: result,
      actionTaken: command,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function processAIRequest(
  request: string,
  context?: Record<string, unknown>
): Promise<CommandResult> {
  return executeCommand(request, context);
}

export async function getAgentStatus(): Promise<AgentStatus> {
  const { success, requests } = await getPendingApprovals();
  if (success && requests) {
    agentStatus.pendingApprovals = requests.length;
  }

  const { success: goalsSuccess, goals } = await getActiveGoals();
  if (goalsSuccess && goals) {
    agentStatus.goalsActive = goals.length;
  }

  agentStatus.lastCheck = new Date();
  agentStatus.nextCheck = new Date(Date.now() + currentConfig.checkIntervalMinutes * 60 * 1000);

  return { ...agentStatus };
}

export async function runProactiveCheck(): Promise<CommandResult> {
  const anomaliesResult = await detectAnomalies();
  const opportunitiesResult = await generateOpportunities();

  return {
    success: true,
    message: `Proactive check completed. Found ${anomaliesResult.anomalies?.length || 0} anomalies and ${opportunitiesResult.opportunities?.length || 0} opportunities.`,
    data: {
      anomalies: anomaliesResult.anomalies,
      opportunities: opportunitiesResult.opportunities,
    },
  };
}

export async function handleApproval(
  requestId: string,
  approved: boolean,
  approvedBy: string,
  reason?: string
): Promise<CommandResult> {
  try {
    if (approved) {
      await approveRequest(requestId, approvedBy);
    } else {
      await rejectRequest(requestId, approvedBy, reason || "Rejected without reason");
    }

    return {
      success: true,
      message: approved ? "Request approved" : "Request rejected",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to handle approval",
    };
  }
}

export async function generateDailyReport(): Promise<CommandResult> {
  const metrics = await getMetricsSnapshot();
  const status = await getAgentStatus();

  return {
    success: true,
    message: `Daily report generated`,
    data: {
      metrics,
      status,
    },
  };
}

export interface AgentResponse {
  action: string;
  params: Record<string, unknown>;
  reply: string;
}

export class UltimateAgent {
  async processCommand(userMessage: string, userId: string): Promise<string> {
    try {
      const systemPrompt = `${SYSTEM_PROMPT}

الرسالة الحالية: "${userMessage}"

أخرج JSON فقط بدون أي شرح إضافي.`;

      const result = await askDeepSeek(systemPrompt, { jsonMode: true });
      if (!result.success) {
        throw new Error(result.error);
      }
      const parsed: AgentResponse = JSON.parse(result.content);

      let executionResult = null;
      
      if (parsed.action && parsed.action !== "null") {
        switch (parsed.action) {
          case "updateSiteSetting":
            executionResult = await updateSiteSetting({ key: parsed.params.key as "theme" | "seo" | "general", value: parsed.params.value as Record<string, unknown> });
            break;
          case "createAutomationRule":
            executionResult = await createAutomationRule(parsed.params as any);
            break;
          case "getAnalytics":
            executionResult = await getAnalyticsReport(parsed.params as any);
            if (executionResult.success) {
              parsed.reply = `${parsed.reply}\n\n📊 ${JSON.stringify(executionResult.data || {})}`;
            }
            break;
          case "getSystemHealth":
            executionResult = await getSystemHealth();
            if (executionResult.success) {
              const healthData = executionResult.data as { health?: { status?: string } };
            parsed.reply = `${parsed.reply}\n\n🔍 الحالة: ${healthData?.health?.status || "OK"}`;
            }
            break;
        }

        if (executionResult?.success) {
          await storeMemory({
            type: "outcome",
            category: parsed.action,
            content: parsed.reply,
            priority: "normal",
            context: { action: parsed.action, params: parsed.params },
          });
        }
      }

      return parsed.reply;
    } catch (error) {
      console.error("[UltimateAgent] Error:", error);
      return this.fallbackResponse(userMessage);
    }
  }

  private fallbackResponse(message: string): string {
    const lower = message.toLowerCase();
    
    if (/مساء|صباح|أهلا|مرحب|هاي|سلام/i.test(lower)) {
      const greetings = [
        "أهلاً بيك، نورت! 🌟",
        "أهلاً وسهلاً! كيف أقدر أساعدك؟ 👋",
        "مساء الفل! إيه الأخبار؟ 🌙",
        "هلا والله! شرفتنا 🎉"
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }
    
    if (/(غير|غيّر|عدل).*(لون|أزرار)/i.test(lower)) {
      return "تمام! غيرت اللون 🎨 (ملاحظة: استخدمت fallback mode)";
    }
    
    if (/(زوار|زيارات|عدد)/i.test(lower)) {
      return "جاري جلب تقرير الزوار... 📊 (ملاحظة: استخدمت fallback mode)";
    }
    
    return "آسف، حصل مشكلة في الاتصال. جرب تاني بعد شوية. 😅";
  }
}

export { storeMemory, searchMemories, getUserPreference, storeUserPreference };
export { classifyRisk, validateAction, getPendingApprovals, getSecurityStats };
export { getMetricsSnapshot, analyzeTrend, detectAnomalies, generateOpportunities };
export { executeAction, executeBatch, executeCodeSuggestion };
export { createGoal };
