/**
 * Agent Orchestrator - Routes tasks to the appropriate agent
 * Manages PRIME and Vanguard agents with intelligent routing
 */

import { PRIMEAgent, primeAgent, PRIMETask } from "./PRIMEAgent";
import { VanguardAgent, vanguardAgent, VanguardTask } from "./VanguardAgent";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type AgentType = "prime" | "vanguard" | "auto";

export interface AgentMessage {
  id: string;
  agent_key: AgentType;
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AgentOrchestratorResult {
  success: boolean;
  agentUsed: AgentType;
  response: string;
  metadata?: {
    suggestions?: string[];
    actionItems?: string[];
    priority?: string;
    designParameters?: Record<string, any>;
    taskId?: string;
  };
}

export class AgentOrchestrator {
  private agents: Record<string, PRIMEAgent | VanguardAgent>;

  constructor() {
    this.agents = {
      prime: primeAgent,
      vanguard: vanguardAgent,
    };
  }

  async chat(agentKey: AgentType, message: string, context?: Record<string, any>): Promise<AgentOrchestratorResult> {
    const selectedAgent = agentKey === "auto" ? this.detectAgent(message) : agentKey;

    try {
      let response: string;
      let metadata: AgentOrchestratorResult["metadata"] = {};

      if (selectedAgent === "prime") {
        const result = await primeAgent.chat(message, context);
        response = result;
      } else {
        const result = await vanguardAgent.chat(message, context);
        response = result;
      }

      return {
        success: true,
        agentUsed: selectedAgent,
        response,
        metadata,
      };
    } catch (error: any) {
      return {
        success: false,
        agentUsed: selectedAgent,
        response: `⚠️ خطأ في النظام: ${error.message || "خطأ غير معروف"}. يرجى المحاولة مرة أخرى.`,
      };
    }
  }

  async executeTask(agentKey: AgentType, task: PRIMETask | VanguardTask): Promise<AgentOrchestratorResult> {
    try {
      if (agentKey === "prime" || (task as PRIMETask).type === "design" || (task as PRIMETask).type === "manufacturing") {
        const result = await primeAgent.process(task as PRIMETask);
        return {
          success: result.success,
          agentUsed: "prime",
          response: result.output,
          metadata: {
            suggestions: result.suggestions,
            designParameters: result.designParameters,
            taskId: result.taskId,
          },
        };
      }

      const result = await vanguardAgent.process(task as VanguardTask);
      return {
        success: result.success,
        agentUsed: "vanguard",
        response: result.output,
        metadata: {
          actionItems: result.actionItems,
          priority: result.priority,
          taskId: result.taskId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        agentUsed: agentKey === "auto" ? "prime" : agentKey,
        response: `⚠️ خطأ في تنفيذ المهمة: ${error.message || "خطأ غير معروف"}`,
      };
    }
  }

  async getAgentStatus(agentKey: AgentType): Promise<{
    agent: AgentType;
    status: "online" | "offline" | "busy";
    taskCount: number;
    recentActivity: string;
  }> {
    const supabase = getSupabaseAdminClient();

    try {
      if (supabase) {
        const { data: agentProfile } = await supabase
          .from("agent_profiles")
          .select("id")
          .eq("agent_key", agentKey === "auto" ? "prime" : agentKey)
          .single();

        if (agentProfile) {
          const { count } = await supabase
            .from("agent_tasks")
            .select("*", { count: "exact", head: true })
            .eq("agent_profile_id", agentProfile.id)
            .eq("status", "running");

          const { data: lastTask } = await supabase
            .from("agent_tasks")
            .select("completed_at")
            .eq("agent_profile_id", agentProfile.id)
            .eq("status", "completed")
            .order("completed_at", { ascending: false })
            .limit(1)
            .single();

          return {
            agent: agentKey,
            status: (count || 0) > 0 ? "busy" : "online",
            taskCount: count || 0,
            recentActivity: lastTask?.completed_at || "لا يوجد نشاط حديث",
          };
        }
      }
    } catch (err) {
      console.error("[Orchestrator] Status check error:", err);
    }

    return {
      agent: agentKey,
      status: "offline",
      taskCount: 0,
      recentActivity: "غير متاح",
    };
  }

  private detectAgent(message: string): AgentType {
    const lowerMessage = message.toLowerCase();

    const primeKeywords = [
      "تصميم", "تصميم", "لون", "خشب", "معدن", "قماش", "أثاث", "مجلس",
      "طاولة", "كرسي", "سرير", "خزانة", "رف", "إضاءة", "تصنيع", "إنتاج",
      "جودة", "قياس", "مقاس", "ابعاد", "رسم", "نموذج", "3d", "رسم هندسي",
      "خامة", "مادة", "معدني", "خشبي", "تنجيد", "دهان", "تشطيب",
      "design", "furniture", "wood", "metal", "fabric", "color",
    ];

    const vanguardKeywords = [
      "سعر", "تكلفة", "ميزانية", "عرض سعر", "فاتورة", "دفع", "حساب",
      "طلب", "أمر شراء", "شحن", "توصيل", "تركيب", "موعد", "حجز",
      "عميل", "زبون", "متابعة", "اتصال", "رسالة", "واتساب", "إيميل",
      "شكوى", "مشكلة", "استبدال", "إرجاع", "ضمان", "صيانة",
      "price", "cost", "budget", "quote", "invoice", "payment",
      "order", "shipping", "delivery", "installation",
      "customer", "client", "follow up", "call", "message",
    ];

    let primeScore = 0;
    let vanguardScore = 0;

    for (const keyword of primeKeywords) {
      if (lowerMessage.includes(keyword)) primeScore++;
    }

    for (const keyword of vanguardKeywords) {
      if (lowerMessage.includes(keyword)) vanguardScore++;
    }

    return primeScore >= vanguardScore ? "prime" : "vanguard";
  }

  async logEvent(eventType: string, agentKey: string, data: Record<string, any>) {
    try {
      const supabase = getSupabaseAdminClient();
      if (!supabase) return;

      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("agent_key", agentKey)
        .maybeSingle();

      await supabase.from("agent_events").insert({
        company_id: "00000000-0000-0000-0000-000000000000",
        agent_profile_id: agentProfile?.id || null,
        event_type: eventType,
        event_data: data,
        severity: "info",
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Orchestrator] Event log error:", err);
    }
  }
}

export const agentOrchestrator = new AgentOrchestrator();
