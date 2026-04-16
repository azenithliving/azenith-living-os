import { createLLMClient } from "@/lib/ai-orchestrator";
import { updateSiteSetting, createAutomationRule, getAnalyticsReport, getSystemHealth } from "@/lib/architect-tools";
import { supabaseService } from "@/lib/supabase-service";

// Types for backward compatibility
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

export interface AgentResponse {
  action: string;
  params: Record<string, unknown>;
  reply: string;
}

// Default config
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

// Stub functions for backward compatibility
export async function initializeAgent(config?: Partial<AgentConfig>): Promise<{ success: boolean; message: string; status: AgentStatus }> {
  if (config) {
    currentConfig = { ...currentConfig, ...config };
  }
  return {
    success: true,
    message: `Ultimate Agent "${currentConfig.name}" initialized`,
    status: agentStatus,
  };
}

export function getAgentConfig(): AgentConfig {
  return { ...currentConfig };
}

export async function updateAgentConfig(updates: Partial<AgentConfig>): Promise<{ success: boolean; message: string }> {
  currentConfig = { ...currentConfig, ...updates };
  return { success: true, message: "Configuration updated" };
}

export async function getAgentStatus(): Promise<AgentStatus> {
  agentStatus.lastCheck = new Date();
  return { ...agentStatus };
}

export async function executeCommand(command: string, context?: Record<string, unknown>): Promise<CommandResult> {
  try {
    const agent = new UltimateAgent();
    const result = await agent.processCommand(command, "system");
    return { success: true, message: result, actionTaken: command };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function processAIRequest(request: string, context?: Record<string, unknown>): Promise<CommandResult> {
  return executeCommand(request, context);
}

export async function runProactiveCheck(): Promise<CommandResult> {
  return { success: true, message: "Proactive check completed (stub)", data: { anomalies: [], opportunities: [] } };
}

export async function generateDailyReport(): Promise<CommandResult> {
  return { success: true, message: "Daily report generated (stub)", data: { status: agentStatus } };
}

export async function handleApproval(requestId: string, approved: boolean, approvedBy: string, reason?: string): Promise<CommandResult> {
  return { success: true, message: approved ? "Request approved" : "Request rejected" };
}

// Main Agent Class
export class UltimateAgent {
  private llm: any;

  constructor() {
    this.llm = createLLMClient("deepseek");
  }

  async processCommand(userMessage: string, userId: string): Promise<string> {
    // تخزين رسالة المستخدم في الذاكرة (تمهيداً للمرحلة 2)
    await supabaseService.from("agent_memory").insert({
      user_id: userId,
      memory_type: "conversation",
      content: { role: "user", message: userMessage },
    });

    const lowerMsg = userMessage.toLowerCase();
    let reply = "";

    // pattern matching للأوامر الإدارية
    if (lowerMsg.includes("لون") || (lowerMsg.includes("غير") && (lowerMsg.includes("الزر") || lowerMsg.includes("الخلفية")))) {
      let color = "#C5A059";
      if (lowerMsg.includes("ذهبي")) color = "#C5A059";
      else if (lowerMsg.includes("أحمر")) color = "#FF0000";
      else if (lowerMsg.includes("أزرق")) color = "#0000FF";
      else if (lowerMsg.includes("أسود")) color = "#000000";
      const result = await updateSiteSetting({ key: "theme", value: { primaryColor: color } });
      reply = result.success ? `تم تغيير اللون إلى ${color} 🎨` : `مشكلة: ${result.message}`;
    } 
    else if (lowerMsg.includes("قاعدة") || lowerMsg.includes("أتمتة")) {
      const name = "قاعدة تلقائية " + new Date().toLocaleTimeString("ar-EG");
      const result = await createAutomationRule({
        name,
        trigger: "page_visit",
        conditions: {},
        actions: [{ type: "whatsapp", message: "مرحباً" }],
        enabled: true
      });
      reply = result.success ? `تم إنشاء قاعدة أتمتة باسم "${name}" ⚙️` : `مشكلة: ${result.message}`;
    }
    else if (lowerMsg.includes("زوار") || lowerMsg.includes("تقرير")) {
      const result = await getAnalyticsReport({ days: 7 });
      reply = result.success ? result.message : `مشكلة: ${result.message}`;
    }
    else if (lowerMsg.includes("صحة") || lowerMsg.includes("شغال") || lowerMsg.includes("النظام")) {
      const result = await getSystemHealth();
      reply = result.success ? result.message : `مشكلة: ${result.message}`;
    }
    else {
      // استخدام LLM للردود العامة
      const systemPrompt = `أنت مساعد ودود اسمك "المهندس المعماري الذكي" لموقع أزينيث ليفينج. رد على المستخدم بالعامية المصرية بلطف. إذا سأل عنك، قل: أنا المهندس المعماري الذكي، مساعدك الشخصي.`;
      const response = await this.llm.complete(`${systemPrompt}\n\nالمستخدم: ${userMessage}`);
      reply = response;
    }

    // تخزين رد الوكيل
    await supabaseService.from("agent_memory").insert({
      user_id: userId,
      memory_type: "conversation",
      content: { role: "assistant", message: reply },
    });

    return reply;
  }
}
