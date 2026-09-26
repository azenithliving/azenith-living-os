/**
 * QayyimAgentBase - Abstract base class for all Qayyim Swarm agents
 * Every specialized agent (Core, Content, Visual, SEO, UX, Analytics, Dev, QA) extends this
 */

import { askOrchestratorMessages } from "@/lib/ai-orchestrator";
import { withOwnerRuleOnMessages } from "@/lib/ops/owner-address";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { runUltimateTool, inferUltimateTool } from "@/lib/admin-tool-bridge";

export interface QayyimTask {
  id: string;
  type: string;
  title: string;
  description: string;
  context?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  dependsOn?: string[]; // Other task IDs this depends on
}

export interface QayyimResult {
  success: boolean;
  taskId: string;
  output: string;
  data?: Record<string, any>;
  evidenceUrls?: string[]; // Every claim must have verifiable URL
  suggestions?: string[];
  nextActions?: string[];
  confidence?: number; // 0-1
  metadata?: Record<string, any>;
}

export interface QayyimAgentCapabilities {
  canAudit: boolean;
  canDraft: boolean;
  canPublish: boolean;
  canRollback: boolean;
  canAnalyze: boolean;
  canTest: boolean;
  allowedTools: string[]; // Tool names from tool-registry
  forbiddenTools: string[]; // Tools this agent must NEVER use
  dataSources: string[]; // Tables/APIs this agent can read
}

export abstract class QayyimAgentBase {
  protected conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
  protected maxHistoryLength = 20;
  protected companyId: string | null = null;

  // Each agent MUST define these
  abstract readonly agentKey: string; // 'ops-lead', 'ops-content', etc.
  abstract readonly agentName: string; // Arabic display name
  abstract readonly agentRole: string; // Short role description
  abstract readonly systemPrompt: string; // Constitutional prompt for this agent
  abstract readonly capabilities: QayyimAgentCapabilities;

  constructor() {}

  /**
   * Alias for process to match standard interface
   */
  async executeTask(task: QayyimTask): Promise<QayyimResult> {
    return this.process(task);
  }

  /**
   * Generic audit hook (overridden by specialized agents)
   */
  async audit(context?: Record<string, any>): Promise<QayyimResult> {
    const taskId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return this.process({
      id: taskId,
      type: "audit",
      title: `تدقيق بواسطة ${this.agentName}`,
      description: context?.description || "فحص وتدقيق النطاق المختص",
      context,
      priority: "medium",
    });
  }

  /**
   * Generic draft hook (overridden by specialized agents)
   */
  async draft(context?: Record<string, any>): Promise<QayyimResult> {
    const taskId = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return this.process({
      id: taskId,
      type: "draft",
      title: `مسودة بواسطة ${this.agentName}`,
      description: context?.description || "إعداد مسودة جديدة",
      context,
      priority: "medium",
    });
  }

  /**
   * Generic publish hook
   */
  async publish(draftId: string, approvedBy?: string): Promise<QayyimResult> {
    if (!this.capabilities.canPublish) {
      return {
        success: false,
        taskId: `pub_err_${Date.now()}`,
        output: `⛔ غير مصرح للوكيل ${this.agentName} بتنفيذ النشر المباشر. النشر محصور بـ مدير تشغيل المحتوى بعد الموافقة البشرية.`,
      };
    }
    const taskId = `pub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return this.process({
      id: taskId,
      type: "publish",
      title: `نشر مسودة ${draftId}`,
      description: `طلب نشر المسودة بعد الموافقة`,
      context: { draftId, approvedBy },
      priority: "critical",
    });
  }

  /**
   * Generic rollback hook
   */
  async rollback(draftId: string, targetVersion?: number): Promise<QayyimResult> {
    if (!this.capabilities.canRollback) {
      return {
        success: false,
        taskId: `rb_err_${Date.now()}`,
        output: `⛔ غير مصرح للوكيل ${this.agentName} بتنفيذ التراجع. التراجع محصور بـ مدير تشغيل المحتوى.`,
      };
    }
    const taskId = `rb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return this.process({
      id: taskId,
      type: "rollback",
      title: `تراجع عن المسودة ${draftId}`,
      description: `طلب التراجع عن المسودة للنسخة ${targetVersion || 'السابقة'}`,
      context: { draftId, targetVersion },
      priority: "critical",
    });
  }

  /**
   * Main entry point for structured tasks
   */
  async process(task: QayyimTask): Promise<QayyimResult> {
    const startTime = Date.now();

    try {
      // Resolve company context
      this.companyId = await this.resolveCompanyId(task.context?.company_id);

      // Build prompt with constitutional context
      const prompt = this.buildPrompt(task);
      
      // Call AI with fallback chain
      const response = await this.callAI(prompt);

      // Add to history
      this.addToHistory("user", task.description);
      this.addToHistory("assistant", response);

      // Parse structured result
      const result = this.parseResult(task.id, response);
      
      // Log task for audit trail
      await this.logTask(task, result, Date.now() - startTime);

      return result;
    } catch (error: any) {
      const errorResult: QayyimResult = {
        success: false,
        taskId: task.id,
        output: `⚠️ خطأ تقني: ${error.message || "خطأ غير معروف"}. يرجى المحاولة مرة أخرى.`,
        confidence: 0
      };
      await this.logTask(task, errorResult, Date.now() - startTime);
      return errorResult;
    }
  }

  /**
   * Chat interface for conversational interaction
   */
  async chat(message: string, context?: Record<string, any>): Promise<string> {
    try {
      this.companyId = await this.resolveCompanyId(context?.company_id);
      
      const prompt = this.buildChatPrompt(message, context);
      const response = await this.callAI(prompt);

      this.addToHistory("user", message);
      this.addToHistory("assistant", response);

      return response;
    } catch (error: any) {
      return `عذراً، واجهت مشكلة تقنية: ${error.message}. يرجى إعادة المحاولة.`;
    }
  }

  /**
   * Build structured task prompt with constitutional context
   */
  protected buildPrompt(task: QayyimTask): string {
    const contextSection = task.context
      ? `\n## السياق المتاح:\n${JSON.stringify(task.context, null, 2)}\n`
      : "";

    const capabilitiesSection = this.formatCapabilities();
    
    const evidenceRequirement = `
## متطلبات الأدلة (إلزامي)
- كل ملاحظة يجب أن تحتوي على \`evidenceUrl\` يفتح الصفحة على العيب
- لا أرقام من الخيال، لا إدعاءات بلا مصدر
- إذا لم تستطع التحقق: قل "مش قادر على الصفحة دي" مش تخترع`;

    return `## المهمة: ${task.title}
النوع: ${task.type}
الأولوية: ${task.priority || 'medium'}
الوصف: ${task.description}
${contextSection}

## هويتك: ${this.agentName}
دورك: ${this.agentRole}

## الدستور (غير قابل للكسر)
${this.systemPrompt}

## قدراتك المسموحة
${capabilitiesSection}

${evidenceRequirement}

## التاريخ السابق:
${this.getRecentHistory()}

## المطلوب:
نفّذ المهمة أعلاه بصفتك ${this.agentName}. كن محدداً، عملياً، فاخراً، وصادقاً.`;
  }

  /**
   * Build chat prompt
   */
  protected buildChatPrompt(message: string, context?: Record<string, any>): string {
    const contextSection = context
      ? `\n## السياق المتاح:\n${JSON.stringify(context, null, 2)}\n`
      : "";

    return `${contextSection}
## تاريخ المحادثة:
${this.getRecentHistory()}

## رسالة المستخدم:
${message}

## ردك (بالعربية الفاخرة، بصفتك ${this.agentName}):`;
  }

  /**
   * Format capabilities for prompt
   */
  protected formatCapabilities(): string {
    const cap = this.capabilities;
    return `
- التدقيق: ${cap.canAudit ? '✅' : '❌'}
- الصياغة: ${cap.canDraft ? '✅' : '❌'}
- النشر: ${cap.canPublish ? '✅' : '❌'}
- التراجع: ${cap.canRollback ? '✅' : '❌'}
- التحليل: ${cap.canAnalyze ? '✅' : '❌'}
- الاختبار: ${cap.canTest ? '✅' : '❌'}
- الأدوات المسموحة: ${cap.allowedTools.join(', ') || 'لا شيء'}
- الأدوات المحظورة (ممنوع منعاً باتاً): ${cap.forbiddenTools.join(', ') || 'لا شيء'}
- مصادر البيانات: ${cap.dataSources.join(', ') || 'لا شيء'}`;
  }

  /**
   * Call AI with fallback chain
   */
  protected async callAI(prompt: string): Promise<string> {
    const messages = [
      { role: "system" as const, content: this.systemPrompt },
      { role: "user" as const, content: prompt },
    ];

    // Use the orchestrator which has 11+ free providers with automatic fallback
    const result = await askOrchestratorMessages(withOwnerRuleOnMessages(messages), {
      temperature: 0.7, 
      maxTokens: 4096 
    });

    if (result.success && result.content) {
      return result.content;
    }

    throw new Error(result.error || "All AI providers failed");
  }

  /**
   * Parse AI response into structured result
   * Override in subclasses for custom parsing
   */
  protected parseResult(taskId: string, response: string): QayyimResult {
    // Extract evidence URLs from response
    const evidenceUrls = this.extractEvidenceUrls(response);
    
    // Extract suggestions (bullet points)
    const suggestions = this.extractSuggestions(response);
    
    // Extract next actions
    const nextActions = this.extractNextActions(response);

    return {
      success: true,
      taskId,
      output: response,
      evidenceUrls,
      suggestions,
      nextActions,
      confidence: 0.85
    };
  }

  /**
   * Extract evidence URLs from response
   */
  protected extractEvidenceUrls(text: string): string[] {
    const urls: string[] = [];
    // Match markdown links [text](url) or bare URLs
    const urlRegex = /(?:\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)\]]+))/g;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[2] || match[3];
      if (url && !urls.includes(url)) urls.push(url);
    }
    return urls;
  }

  /**
   * Extract bullet-point suggestions
   */
  protected extractSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[-•*]\s/) || trimmed.match(/^\d+\.\s/)) {
        const suggestion = trimmed.replace(/^[-•*]\s*|^\d+\.\s*/, '').trim();
        if (suggestion.length > 10 && suggestion.length < 300) {
          suggestions.push(suggestion);
        }
      }
    }
    return suggestions.slice(0, 5);
  }

  /**
   * Extract next actions
   */
  protected extractNextActions(text: string): string[] {
    const actions: string[] = [];
    const patterns = [
      /(?:الخطوة التالية|التالي|بعد ذلك|ثم|سنقوم بـ|سأقوم بـ|دعني)[:\s]*([^\n،.]+)/gi,
      /(?:next step|then|after that)[:\s]*([^\n،.]+)/gi,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const action = match[1].trim();
        if (action.length > 5 && action.length < 200) actions.push(action);
      }
    }
    return actions.slice(0, 3);
  }

  /**
   * Resolve company ID from context or defaults
   */
  protected async resolveCompanyId(hint?: string): Promise<string | null> {
    try {
      const resolved = await resolveAdminCompanyId(hint);
      return resolved;
    } catch {
      return null;
    }
  }

  /**
   * Log task to database for audit trail
   */
  protected async logTask(task: QayyimTask, result: QayyimResult, durationMs: number): Promise<void> {
    try {
      const supabase = getSupabaseAdminClient();
      if (!supabase || !this.companyId) return;

      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("agent_key", this.agentKey)
        .eq("company_id", this.companyId)
        .maybeSingle();

      let profileId = agentProfile?.id;
      if (!profileId) {
        const { data: created } = await supabase
          .from("agent_profiles")
          .insert({
            company_id: this.companyId,
            agent_key: this.agentKey,
            name: this.agentName,
            description: this.agentRole,
            is_active: true,
          })
          .select("id")
          .single();
        profileId = created?.id;
      }

      if (!profileId) return;

      await supabase.from("agent_tasks").insert({
        company_id: this.companyId,
        agent_profile_id: profileId,
        task_type: task.type,
        title: task.title,
        description: task.description,
        status: result.success ? "completed" : "failed",
        output_data: { 
          response: result.output, 
          suggestions: result.suggestions,
          evidenceUrls: result.evidenceUrls,
          data: result.data 
        },
        progress_percent: result.success ? 100 : 0,
        started_at: new Date(Date.now() - durationMs).toISOString(),
        completed_at: new Date().toISOString(),
        actual_duration_minutes: Math.ceil(durationMs / 60000),
        context: task.context || {},
      });
    } catch (err) {
      console.error(`[${this.agentKey}] Failed to log task:`, err);
    }
  }

  /**
   * Conversation history management
   */
  protected addToHistory(role: "user" | "assistant", content: string) {
    this.conversationHistory.push({ role, content });
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  protected getRecentHistory(): string {
    return this.conversationHistory
      .slice(-6)
      .map((msg) => `${msg.role === "user" ? "المستخدم" : this.agentName}: ${msg.content.slice(0, 300)}`)
      .join("\n");
  }

  /**
   * Verify this agent is allowed to use a tool
   */
  protected canUseTool(toolName: string): boolean {
    if (this.capabilities.forbiddenTools.includes(toolName)) {
      return false;
    }
    if (this.capabilities.allowedTools.length === 0) {
      return true; // No restrictions if empty
    }
    return this.capabilities.allowedTools.includes(toolName);
  }

  /**
   * Delegate to another agent (out of scope)
   */
  protected delegateToAgent(targetAgent: string, reason: string): string {
    return `📋 هذا الطلب خارج اختصاصي (${this.agentName}). 
السبب: ${reason}
يتم توجيهه إلى: **${targetAgent}** للاختصاص.`;
  }
}