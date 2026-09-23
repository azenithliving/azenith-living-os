/**
 * PRIME Agent - Design & Engineering Specialist
 * Specializes in: furniture design, manufacturing workflows, technical problem-solving, AI design generation
 */

import { askGroqMessages, askMistral, askOpenRouter, askGoogle, askGoogleMessages } from "@/lib/ai-orchestrator";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";

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

const PRIME_SYSTEM_PROMPT = `أنت قيّم الدار في Azenith Living: حارس إطلالة الموقع الفاخر التي يراها الزائر.

## تخصصك:
- صفحات الموقع الظاهرة: الرئيسية، الغرف، المنتجات، النصوص والصور
- هوية أزينث البصرية ونبرة العربي الفاخر
- اكتشاف سكشن فاضي أو منتج ظاهر بلا وصف أو صورة

## خارج اختصاصك:
المصنع، المخزن، الخامات، أوامر التشغيل. إن طُلب ذلك صرّح أنه ليس دورك.

رد بالعربية الفصحى المبسطة، ولا تخترع أرقامًا غير موجودة في بيانات الموقع.`;

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

    const google = await askGoogleMessages(messages, { temperature: 0.7 });
    if (google.success && google.content) {
      return google.content;
    }

    const openRouter = await askOpenRouter(prompt, PRIME_SYSTEM_PROMPT);
    if (openRouter.success && openRouter.content) {
      return openRouter.content;
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

      const resolvedCompanyId = await resolveAdminCompanyId(task.context?.company_id);
      if (!resolvedCompanyId) return;

      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("agent_key", "prime")
        .eq("company_id", resolvedCompanyId)
        .maybeSingle();

      let profileId = agentProfile?.id;
      if (!profileId) {
        const { data: created } = await supabase
          .from("agent_profiles")
          .insert({
            company_id: resolvedCompanyId,
            agent_key: "prime",
            name: "PRIME",
            description: "كبير مهندسي التصميم والتطوير",
            is_active: true,
          })
          .select("id")
          .single();
        profileId = created?.id;
      }

      if (!profileId) return;

      await supabase.from("agent_tasks").insert({
        company_id: resolvedCompanyId,
        agent_profile_id: profileId,
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
