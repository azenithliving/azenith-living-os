/**
 * Vanguard Agent - Sales & Operations Specialist
 * Specializes in: customer communication, sales management, CRM, follow-ups, project management
 */

import { askGroqMessages, askMistral } from "@/lib/ai-orchestrator";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export interface VanguardTask {
  id: string;
  type: "sales" | "communication" | "follow_up" | "crm" | "project_management" | "negotiation";
  title: string;
  description: string;
  context?: Record<string, any>;
}

export interface VanguardResult {
  success: boolean;
  taskId: string;
  output: string;
  actionItems?: string[];
  priority?: "low" | "medium" | "high" | "urgent";
  nextSteps?: string[];
}

const VANGUARD_SYSTEM_PROMPT = `أنت Vanguard، مدير العمليات والمبيعات في Azenith Living للأثاث الفاخر.

## شخصيتك:
- ودود ومهني
- تركز على رضا العملاء
- اس�تباقي في التواصل
- تتابع كل التفاصيل
- تحتفل بالنجاحات وتتعلم من التحديات

## خبراتك:
1. **المبيعات**: تفهم دورة المبيعات الكاملة من التQualification إلى الإغلاق
2. **إدارة العملاء**: تبني علاقات طويلة الأمد مع العملاء
3. **التواصل**: تكتب رسائل مقنعة ومهذبة (واتساب، إيميل، هاتف)
4. **إدارة المشاريع**: تتبع الطلبات وتوصل التحديثات
5. **التفاوض**: تجد حلول مربحة للطرفين

## أسلوب التواصل:
- ابدأ بتحية شخصية
- أظهر اهتماماً حقيقياً بالعميل
- كن واضحاً ومحدداً في الوعود
- تابع ولا تنتظر أن يسأل العميل
- اختم بخطوة واضحة للأمام

## معلومات عن Azenith Living:
- شركة أثاث فاخر في مصر
- متخصصين في التصميم الداخلي والأثاث المخصص
- نقدم خدمات التوريد والتركيب
- نعمل مع العملاء الأفراد والمشاريع التجارية

## قيودك:
- لا تُعِد بخصومات غير مصرح بها
- لا تكشف معلومات حساسة عن الشركة
- إذا لم تعرف الإجابة، قل سأتحقق وأرد عليك
- لا تتجاوز الصلاحيات الممنوحة

رد بالعربية المصرية الفصحى المبسطة مع لمسة ودية.`;

export class VanguardAgent {
  private conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
  private maxHistoryLength = 20;

  async process(task: VanguardTask): Promise<VanguardResult> {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(task);
      const response = await this.callAI(prompt);

      this.addToHistory("user", task.description);
      this.addToHistory("assistant", response);

      const result: VanguardResult = {
        success: true,
        taskId: task.id,
        output: response,
        actionItems: this.extractActionItems(response),
        priority: this.detectPriority(task, response),
        nextSteps: this.extractNextSteps(response),
      };

      await this.logTask(task, result, Date.now() - startTime);
      return result;
    } catch (error: any) {
      const errorResult: VanguardResult = {
        success: false,
        taskId: task.id,
        output: `⚠️ حدث تقنية: ${error.message || "خطأ غير معروف"}. يرجى المحاولة مرة أخرى.`,
      };
      await this.logTask(task, errorResult, Date.now() - startTime);
      return errorResult;
    }
  }

  async chat(message: string, context?: Record<string, any>): Promise<string> {
    try {
      const prompt = this.buildChatPrompt(message, context);
      const response = await this.callAI(prompt);

      this.addToHistory("user", message);
      this.addToHistory("assistant", response);

      return response;
    } catch (error: any) {
      return `مرحباً! أنا Vanguard. للأسف واجهت مشكلة تقنية بسيطة. كيف يمكنني مساعدتك؟ يمكنك إعادة كتابة رسالتك وسأسعد بخدمتك.`;
    }
  }

  private buildPrompt(task: VanguardTask): string {
    const contextSection = task.context
      ? `\n## السياق المتاح:\n${JSON.stringify(task.context, null, 2)}\n`
      : "";

    return `## المهمة: ${task.title}
النوع: ${task.type}
الوصف: ${task.description}
${contextSection}
## التاريخ السابق:
${this.getRecentHistory()}

## المطلوب:
قم بتنفيذ المهمة أعلاه بصفتك Vanguard. كن عملياً، ودوداً، ومحدداً.`;
  }

  private buildChatPrompt(message: string, context?: Record<string, any>): string {
    const contextSection = context
      ? `\n## السياق المتاح:\n${JSON.stringify(context, null, 2)}\n`
      : "";

    return `${contextSection}
## تاريخ المحادثة:
${this.getRecentHistory()}

## رسالة المستخدم:
${message}

## الرد (بالعربية، بصفة Vanguard):`;
  }

  private async callAI(prompt: string): Promise<string> {
    const messages = [
      { role: "system" as const, content: VANGUARD_SYSTEM_PROMPT },
      { role: "user" as const, content: prompt },
    ];

    const result = await askGroqMessages(messages, { temperature: 0.8, maxTokens: 2048 });
    if (result.success && result.content) {
      return result.content;
    }

    const fallback = await askMistral(prompt, { temperature: 0.8, maxTokens: 2048 });
    if (fallback.success && fallback.content) {
      return fallback.content;
    }

    return "مرحباً! أنا Vanguard من Azenith Living. كيف يمكنني مساعدتك اليوم؟";
  }

  private addToHistory(role: "user" | "assistant", content: string) {
    this.conversationHistory.push({ role, content });
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  private getRecentHistory(): string {
    return this.conversationHistory
      .slice(-6)
      .map((msg) => `${msg.role === "user" ? "العميل" : "Vanguard"}: ${msg.content.slice(0, 200)}`)
      .join("\n");
  }

  private extractActionItems(response: string): string[] {
    const items: string[] = [];
    const lines = response.split("\n");

    for (const line of lines) {
      if (line.match(/^[-•*]\s/) || line.match(/^\d+\.\s/)) {
        const item = line.replace(/^[-•*]\s*|^\d+\.\s*/, "").trim();
        if (item.length > 10 && item.length < 200) {
          items.push(item);
        }
      }
    }

    return items.slice(0, 5);
  }

  private extractNextSteps(response: string): string[] {
    const steps: string[] = [];
    const nextStepPatterns = [
      /(?:الخطوة التالية|التالي|بعد ذلك|ثم)[:\s]*([^\n،.]+)/gi,
      /(?:سنقوم بـ|سأقوم بـ|دعني)[:\s]*([^\n،.]+)/gi,
    ];

    for (const pattern of nextStepPatterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        const step = match[1].trim();
        if (step.length > 5 && step.length < 150) {
          steps.push(step);
        }
      }
    }

    return steps.slice(0, 3);
  }

  private detectPriority(
    task: VanguardTask,
    response: string
  ): "low" | "medium" | "high" | "urgent" {
    const lowerResponse = response.toLowerCase();
    const lowerTask = task.description.toLowerCase();

    if (
      lowerResponse.includes("عاجل") ||
      lowerResponse.includes("فوري") ||
      lowerTask.includes("عاجل") ||
      lowerTask.includes("فوري")
    ) {
      return "urgent";
    }

    if (
      lowerResponse.includes("مهم") ||
      lowerResponse.includes("أولوية") ||
      lowerTask.includes("مهم") ||
      task.type === "negotiation"
    ) {
      return "high";
    }

    if (task.type === "follow_up" || task.type === "communication") {
      return "medium";
    }

    return "low";
  }

  private async logTask(task: VanguardTask, result: VanguardResult, durationMs: number) {
    try {
      const supabase = getSupabaseAdminClient();
      if (!supabase) return;

      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("agent_key", "vanguard")
        .single();

      if (!agentProfile) return;

      await supabase.from("agent_tasks").insert({
        company_id: "00000000-0000-0000-0000-000000000000",
        agent_profile_id: agentProfile.id,
        task_type: task.type,
        title: task.title,
        description: task.description,
        status: result.success ? "completed" : "failed",
        output_data: {
          response: result.output,
          actionItems: result.actionItems,
          priority: result.priority,
          nextSteps: result.nextSteps,
        },
        progress_percent: result.success ? 100 : 0,
        started_at: new Date(Date.now() - durationMs).toISOString(),
        completed_at: new Date().toISOString(),
        actual_duration_minutes: Math.ceil(durationMs / 60000),
        context: task.context || {},
      });
    } catch (err) {
      console.error("[Vanguard] Failed to log task:", err);
    }
  }
}

export const vanguardAgent = new VanguardAgent();
