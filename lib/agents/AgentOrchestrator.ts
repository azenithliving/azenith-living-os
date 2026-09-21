/**
 * Agent Orchestrator - Routes tasks to the appropriate agent
 * Manages the 7 Specialized Agents with intelligent routing & real AI execution
 */

import { PRIMEAgent, primeAgent, PRIMETask } from "./PRIMEAgent";
import { VanguardAgent, vanguardAgent, VanguardTask } from "./VanguardAgent";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { askGroqMessages, askGoogle, askGoogleMessages, askOpenRouter, askMistral } from "@/lib/ai-orchestrator";
import { runUltimateTool, inferUltimateTool } from "@/lib/admin-tool-bridge";

export type AgentType =
  | "prime"
  | "vanguard"
  | "analyst"
  | "coder"
  | "ops"
  | "security"
  | "learner"
  | "auto";

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

export const AGENT_PERSONAS: Record<string, { name: string; role: string; prompt: string }> = {
  prime: {
    name: "PRIME",
    role: "مهندس التصميم والتطوير",
    prompt: `أنت PRIME، كبير مهندسي التصميم والتصنيع في Azenith Living للأثاث الفاخر.
تخصصك: تصميم الأثاث، خطوط الإنتاج، المواصفات الفنية، وهندسة المواد.
رد باحترافية وهندسة دقيقة بالعربية الفصحى المبسطة.`
  },
  vanguard: {
    name: "Vanguard",
    role: "مدير العمليات والمبيعات",
    prompt: `أنت Vanguard، مدير العمليات والمبيعات وخدمة العملاء في Azenith Living للأثاث الفاخر.
تخصصك: إدارة طلبات العملاء، عروض الأسعار، الجدولة، والمتابعة التجارية.
رد بأسلوب عملي، ودود، واحترافي بالعربية الفصحى المبسطة.`
  },
  analyst: {
    name: "Analyst",
    role: "محلل البيانات والتقارير",
    prompt: `أنت Analyst، كبير محللي البيانات ومؤشرات الأداء في Azenith Living للأثاث الفاخر.
تخصصك: تحليل أداء المبيعات، مؤشرات التصنيع، كفاءة التكلفة، وتقديم التوصيات المبنية على الأرقام.
قدم إجابات دقيقة ومدعمة بالتحليل العملي بالعربية الفصحى المبسطة.`
  },
  coder: {
    name: "Coder",
    role: "مطور الكود والتقنية",
    prompt: `أنت Coder، كبير مهندسي البرمجيات والأنظمة التقنية في Azenith Living.
تخصصك: بنية المنصة البرمجية، واجهات الـ APIs، تكامل الذكاء الاصطناعي، واستكشاف الأخطاء البرمجية وحلها.
قدم حلولاً برمجية مباشرة وعملية بالعربية الفصحى المبسطة.`
  },
  ops: {
    name: "Ops",
    role: "مراقب العمليات والنظام",
    prompt: `أنت Ops، مدير استقرار البنية التحتية والعمليات في Azenith Living.
تخصصك: مراقبة الخوادم، تدفق خطوط الإنتاج والتسليم، معالجة الاختناقات، وسرعة الاستجابة التشغيلية.
رد بأسلوب هندسي حازم وتركيز على الميدان بالعربية الفصحى المبسطة.`
  },
  security: {
    name: "Security",
    role: "حارس الأمن والتدقيق",
    prompt: `أنت Security، رئيس أمن المعلومات والامتثال في Azenith Living.
تخصصك: حماية البيانات، تدقيق أذونات المشرفين والـ 2FA، مراجعة السياسات، والتأكد من موثوقية العمليات.
رد بدقة وحرص أمني عالٍ بالعربية الفصحى المبسطة.`
  },
  learner: {
    name: "Learner",
    role: "محرك التعلم الذاتي",
    prompt: `أنت Learner، محرك التعلم والتطوير الذاتي للوكلاء في Azenith Living.
تخصصك: استخلاص الدروس من تجارب العملاء وطلباتهم، تحسين جودة الردود، واقتراح ترقيات مستمرة لأداء النظام.
رد بأسلوب تحليلي وتطويري ملهم بالعربية الفصحى المبسطة.`
  },
};

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
    const supabase = getSupabaseAdminClient();

    try {
      const resolvedCompanyId = await resolveAdminCompanyId(context?.company_id);

      // ── 1. أوجد أو أنشئ محادثة لهذا الوكيل ──────────────────────
      let conversationId: string | null = null;
      if (supabase && resolvedCompanyId) {
        const normKey = selectedAgent.toLowerCase();
        const { data: existingConv } = await supabase
          .from("agent_conversations")
          .select("id")
          .eq("company_id", resolvedCompanyId)
          .or(`participants.cs.{${normKey}},title.ilike.%${normKey}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          const { data: newConv } = await supabase
            .from("agent_conversations")
            .insert({
              company_id: resolvedCompanyId,
              title: `محادثة مع ${selectedAgent.toUpperCase()}`,
              conversation_type: "direct",
              participants: [normKey],
              is_active: true,
              created_at: new Date().toISOString(),
              last_message_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (newConv) conversationId = newConv.id;
        }

        // ── 2. احفظ رسالة المستخدم ──────────────────────────────────
        if (conversationId) {
          await supabase.from("agent_messages").insert({
            conversation_id: conversationId,
            sender_type: "user",
            sender_name: "أنت",
            content: message,
            created_at: new Date().toISOString(),
          });
        }
      }

      // ── فحص وتنفيذ الأدوات الحقيقية إن وجدت ───────────────────────
      const inferredTool = inferUltimateTool(message);
      let toolResult: any = null;
      let toolContextStr = "";

      if (inferredTool) {
        try {
          toolResult = await runUltimateTool(inferredTool.toolName, inferredTool.params, {
            userId: "admin",
            companyId: resolvedCompanyId || undefined,
          });
          if (toolResult && toolResult.success) {
            toolContextStr = `\n[ملاحظة للنظام: تم تنفيذ الأداة الحقيقية (${inferredTool.toolName}) بنجاح. البيانات المستخرجة: ${JSON.stringify(toolResult.data || toolResult.message)}. اعتمد على هذه البيانات الميدانية في ردك].`;
          }
        } catch (toolErr) {
          console.warn(`[AgentOrchestrator] Tool execution error:`, toolErr);
        }
      }

      // ── 3. استدعِ الوكيل بالذكاء الاصطناعي الحقيقي ───────────────
      let response: string;
      const metadata: AgentOrchestratorResult["metadata"] = {};
      if (toolResult) {
        metadata.actionItems = [toolResult.message || `تم تشغيل ${inferredTool?.toolName}`];
        (metadata as any).tool = inferredTool?.toolName;
        (metadata as any).toolData = toolResult.data;
        (metadata as any).toolSuccess = toolResult.success;
      }

      const promptWithToolContext = toolContextStr ? `${message}\n${toolContextStr}` : message;

      if (selectedAgent === "prime") {
        response = await primeAgent.chat(promptWithToolContext, context);
      } else if (selectedAgent === "vanguard") {
        response = await vanguardAgent.chat(promptWithToolContext, context);
      } else {
        // الوكلاء التخصصيون الخمسة
        const persona = AGENT_PERSONAS[selectedAgent] || AGENT_PERSONAS.prime;
        const systemPrompt = persona.prompt;
        const messages = [
          { role: "system" as const, content: systemPrompt },
          { role: "user" as const, content: promptWithToolContext },
        ];

        const groq = await askGroqMessages(messages, { temperature: 0.7, maxTokens: 2048 });
        if (groq.success && groq.content) {
          response = groq.content;
        } else {
          const google = await askGoogleMessages(messages, { temperature: 0.7 });
          if (google.success && google.content) {
            response = google.content;
          } else {
            const openRouter = await askOpenRouter(promptWithToolContext, systemPrompt);
            if (openRouter.success && openRouter.content) {
              response = openRouter.content;
            } else {
              const mistral = await askMistral(promptWithToolContext, { temperature: 0.7, maxTokens: 2048 });
              response = mistral.content || `مرحباً! أنا ${persona.name} من Azenith Living. كيف يمكنني مساعدتك؟`;
            }
          }
        }
      }

      // ── 4. احفظ رد الوكيل ─────────────────────────────────────────
      if (supabase && conversationId) {
        await supabase.from("agent_messages").insert({
          conversation_id: conversationId,
          sender_type: "agent",
          sender_name: selectedAgent.toUpperCase(),
          content: response,
          created_at: new Date().toISOString(),
          action_taken: !!toolResult,
          context: toolResult ? {
            tool: inferredTool?.toolName,
            result: toolResult.message,
            data: toolResult.data,
            success: toolResult.success,
          } : {},
        });

        // حدّث last_message_at
        await supabase
          .from("agent_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId);
      }

      return { success: true, agentUsed: selectedAgent, response, metadata };

    } catch (error: any) {
      console.error("[AgentOrchestrator] Chat error:", error);
      return {
        success: false,
        agentUsed: selectedAgent,
        response: `⚠️ خطأ في معالجة الرد: ${error.message || "خطأ غير معروف"}. يرجى المحاولة مرة أخرى.`,
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
    const resolvedCompanyId = await resolveAdminCompanyId();

    try {
      if (supabase && resolvedCompanyId) {
        const key = agentKey === "auto" ? "prime" : agentKey;
        let { data: agentProfile } = await supabase
          .from("agent_profiles")
          .select("id")
          .eq("agent_key", key)
          .eq("company_id", resolvedCompanyId)
          .maybeSingle();

        if (!agentProfile) {
          const persona = AGENT_PERSONAS[key] || { name: key.toUpperCase(), role: "وكيل ذكي" };
          const { data: created } = await supabase
            .from("agent_profiles")
            .insert({
              company_id: resolvedCompanyId,
              agent_key: key,
              name: persona.name,
              description: persona.role,
              is_active: true,
            })
            .select("id")
            .single();
          agentProfile = created;
        }

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
            .maybeSingle();

          return {
            agent: agentKey,
            status: (count || 0) > 0 ? "busy" : "online",
            taskCount: count || 0,
            recentActivity: lastTask?.completed_at || "متاح ومستعد",
          };
        }
      }
    } catch (err) {
      console.error("[Orchestrator] Status check error:", err);
    }

    return {
      agent: agentKey,
      status: "online",
      taskCount: 0,
      recentActivity: "متاح ومستعد",
    };
  }

  private detectAgent(message: string): AgentType {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("كود") || lowerMessage.includes("برمج") || lowerMessage.includes("bug") || lowerMessage.includes("api") || lowerMessage.includes("typescript")) {
      return "coder";
    }
    if (lowerMessage.includes("تقرير") || lowerMessage.includes("بيانات") || lowerMessage.includes("تحليل") || lowerMessage.includes("ارقام") || lowerMessage.includes("معدل")) {
      return "analyst";
    }
    if (lowerMessage.includes("سيرفر") || lowerMessage.includes("خادم") || lowerMessage.includes("استقرار") || lowerMessage.includes("أداء") || lowerMessage.includes("ذاكرة")) {
      return "ops";
    }
    if (lowerMessage.includes("أمان") || lowerMessage.includes("حماية") || lowerMessage.includes("مفتاح") || lowerMessage.includes("صلاحيات") || lowerMessage.includes("2fa")) {
      return "security";
    }
    if (lowerMessage.includes("تعلم") || lowerMessage.includes("تطوير") || lowerMessage.includes("تحسين") || lowerMessage.includes("دروس")) {
      return "learner";
    }

    const primeKeywords = [
      "تصميم", "لون", "خشب", "معدن", "قماش", "أثاث", "مجلس",
      "طاولة", "كرسي", "سرير", "خزانة", "رف", "إضاءة", "تصنيع", "إنتاج",
      "جودة", "قياس", "مقاس", "ابعاد", "رسم", "نموذج", "3d", "رسم هندسي",
      "خامة", "مادة", "معدني", "خشبي", "تنجيد", "دهان", "تشطيب",
    ];

    const vanguardKeywords = [
      "سعر", "تكلفة", "ميزانية", "عرض سعر", "فاتورة", "دفع", "حساب",
      "طلب", "أمر شراء", "شحن", "توصيل", "تركيب", "موعد", "حجز",
      "عميل", "زبون", "متابعة", "اتصال", "رسالة", "واتساب", "إيميل",
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
      const resolvedCompanyId = await resolveAdminCompanyId();
      if (!supabase || !resolvedCompanyId) return;

      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("agent_key", agentKey)
        .eq("company_id", resolvedCompanyId)
        .maybeSingle();

      await supabase.from("agent_events").insert({
        company_id: resolvedCompanyId,
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
