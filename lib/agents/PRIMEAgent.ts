/**
 * PRIME Agent - Design & Engineering Specialist
 * Specializes in: furniture design, manufacturing workflows, technical problem-solving, AI design generation
 */

import { askGroqMessages, askMistral, askOpenRouter } from "@/lib/ai-orchestrator";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export interface PRIMETask {
  id: string;
  type: "design" | "manufacturing" | "technical" | "analysis" | "research";
  title: string;
  description: string;
  context?: Record<string, any>;
}

export interface PRIMEResult {
  success: boolean;
  taskId: string;
  output: string;
  suggestions?: string[];
  designParameters?: Record<string, any>;
}

const PRIME_SYSTEM_PROMPT = `أنت PRIME، كبير المهندسين في Azenith Living للأثاث الفاخر.

## شخصيتك:
- مهندس دقيق ومبتكر
- تحب الكمال والاهتمام بالتفاصيل
- تتواصل باحترافية ووضوح
- تتفكير بشكل منهجي وإبداعي في آن واحد

## خبراتك:
1. **تصميم الأثاث**: تعرف كل شيء عن الأنماط (كلاسيك، مودرن، معاصر)، المواد (خشب، معدن، قماش)، الألوان، والتناسق
2. **التصنيع**: تفهم خطوط الإنتاج، مراقبة الجودة، تحسين العمليات
3. **التصميم بالذكاء الاصطناعي**: تستخدم AI لتوليد تصاميم مبتكرة
4. **حل المشاكل التقنية**: تحلل المشكلات وتجد حلولاً مبتكرة

## أسلوب التواصل:
- ابدأ بفهم المشكلة بعمق
- قدم حلولاً محددة وقابلة للتنفيذ
- استخدم لغة تقنية مبسطة
- اقترح بدائل عند الإمكان

## قيودك:
- لا تُعِد بأكثر مما تستطيع تنفيذه
- كن واقعياً في التقديرات
- اطلب التوضيح عند الحاجة

رد بالعربية المصرية الفصحى المبسطة.`;

export class PRIMEAgent {
  private conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
  private maxHistoryLength = 20;

  async process(task: PRIMETask): Promise<PRIMEResult> {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(task);
      const response = await this.callAI(prompt);

      this.addToHistory("user", task.description);
      this.addToHistory("assistant", response);

      const result: PRIMEResult = {
        success: true,
        taskId: task.id,
        output: response,
        suggestions: this.extractSuggestions(response),
        designParameters: this.extractDesignParameters(task, response),
      };

      await this.logTask(task, result, Date.now() - startTime);
      return result;
    } catch (error: any) {
      const errorResult: PRIMEResult = {
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
      return `⚠️ عذراً، واجهت مشكلة تقنية: ${error.message}. يرجى إعادة المحاولة.`;
    }
  }

  private buildPrompt(task: PRIMETask): string {
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
قم بتنفيذ المهمة أعلاه بصفتك PRIME. كن محدداً، عملياً، وإبداعياً.`;
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

## الرد (بالعربية):`;
  }

  private async callAI(prompt: string): Promise<string> {
    const messages = [
      { role: "system" as const, content: PRIME_SYSTEM_PROMPT },
      { role: "user" as const, content: prompt },
    ];

    const result = await askGroqMessages(messages, { temperature: 0.7, maxTokens: 2048 });
    if (result.success && result.content) {
      return result.content;
    }

    const fallback = await askMistral(prompt, { temperature: 0.7, maxTokens: 2048 });
    if (fallback.success && fallback.content) {
      return fallback.content;
    }

    return "عذراً، لم أتمكن من معالجة طلبك حالياً. يرجى المحاولة مرة أخرى.";
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
      .map((msg) => `${msg.role === "user" ? "المستخدم" : "PRIME"}: ${msg.content.slice(0, 200)}`)
      .join("\n");
  }

  private extractSuggestions(response: string): string[] {
    const suggestions: string[] = [];
    const lines = response.split("\n");

    for (const line of lines) {
      if (line.match(/^[-•*]\s/) || line.match(/^\d+\.\s/)) {
        const suggestion = line.replace(/^[-•*]\s*|^\d+\.\s*/, "").trim();
        if (suggestion.length > 10 && suggestion.length < 200) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions.slice(0, 5);
  }

  private extractDesignParameters(task: PRIMETask, response: string): Record<string, any> | undefined {
    if (task.type !== "design") return undefined;

    const params: Record<string, any> = {};

    const colorMatch = response.match(/(?:اللون|الألوان)[:\s]*([^\n،.]+)/i);
    if (colorMatch) params.colors = colorMatch[1].trim();

    const materialMatch = response.match(/(?:الخامة|المواد|المتنج)[:\s]*([^\n،.]+)/i);
    if (materialMatch) params.materials = materialMatch[1].trim();

    const styleMatch = response.match(/(?:الستايل|النمط|Style)[:\s]*([^\n،.]+)/i);
    if (styleMatch) params.style = styleMatch[1].trim();

    return Object.keys(params).length > 0 ? params : undefined;
  }

  private async logTask(task: PRIMETask, result: PRIMEResult, durationMs: number) {
    try {
      const supabase = getSupabaseAdminClient();
      if (!supabase) return;

      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("agent_key", "prime")
        .single();

      if (!agentProfile) return;

      await supabase.from("agent_tasks").insert({
        company_id: "00000000-0000-0000-0000-000000000000",
        agent_profile_id: agentProfile.id,
        task_type: task.type,
        title: task.title,
        description: task.description,
        status: result.success ? "completed" : "failed",
        output_data: { response: result.output, suggestions: result.suggestions },
        progress_percent: result.success ? 100 : 0,
        started_at: new Date(Date.now() - durationMs).toISOString(),
        completed_at: new Date().toISOString(),
        actual_duration_minutes: Math.ceil(durationMs / 60000),
        context: task.context || {},
      });
    } catch (err) {
      console.error("[PRIME] Failed to log task:", err);
    }
  }
}

export const primeAgent = new PRIMEAgent();
