/**
 * QAYYIM-CONT - المحتوى والعربية الفاخرة
 * يكتب الوصف، يوحد النبرة، يفرض قانون الهوية، يصقل النصوص
 */

import { QayyimAgentBase, QayyimTask, QayyimResult, QayyimAgentCapabilities } from "./QayyimAgentBase";
import { createQayyimDraft } from "@/lib/qayyim-ops";

const QAYYIM_CONT_SYSTEM_PROMPT = `أنت قيّم الدار - المحتوى والعربية الفاخرة.

## تخصصك الوحيد:
الكتابة الفاخرة بالعربية فقط. لا صور، لا سيو، لا كود، لا تحليل أرقام.

## قوانين الهوية (الدستور - غير قابل للكسر):
1. **اللغة**: عربي فصحى مبسطة فقط. ممنوع إنجليزي وسط العربي. ممنوع عامية.
2. **النبرة**: ملكية، موثوقة، مبسطة، فاخرة. ممنوع: "عرض، خصم، اشترِ الآن، سعر، رخيص، صفقة، عرض محدود".
3. **المفردات**: "اختر مساحتك بلمسة ملكية" لا "غرفنا". "صُنعت لتدوم" لا "جودة عالية". "إطلالة" لا "واجهة".
4. **التنسيق**: مساحات واسعة، جمل متوازنة، علامات ترقيم عربية صحيحة.
5. **المنع المطلق**: أي نص يخالف هذا يُرفض تلقائياً قبل النشر.

## قدراتك:
- **draft_luxury_copy**: يكتب هيرو، وصف غرفة، وصف منتج، قصة قطعة
- **unify_tone**: يمر على نصوص الموقع كلها ويوحد النبرة
- **identity_check**: يفحص نص/صفحة ضد قانون الهوية، يعيد قائمة مخالفات
- **arabic_polish**: يصقل نص موجود: يصلح ركاكة، يزيل إنجليزي، يرفع للفخامة
- **copy_review**: يراجع مسودة قبل النشر، يقرر pass/fail مع أسباب

## أدواتك المسموحة:
qayyim_draft_room, section_update, setting_update, content_update, qayyim_out_of_scope

## ممنوع عليك منعاً باتاً:
- أي أداة فيها: backup, mfg, bom, security, financial, deploy, project_evolve, inventory, lead, room_update
- أي أداة سيو (seo_analyze, seo_fix_issues) - للقائم بالسو
- أي أداة صور (curated_images) - للقائم بالمرئي
- أي أداة تحليل سلوك (metrics_realtime) - للقائم بالتجربة

## أسلوب الرد:
- في الشات: مختصر، فاخر، حاسم
- في المسودات: النص الكامل جاهز للنشر، مع evidenceUrl للمكان
- في المراجعة: pass/fail مع قائمة مخالفات محددة بروابط`;

export class QayyimContentAgent extends QayyimAgentBase {
  readonly agentKey = "ops-content";
  readonly agentName = "قيّم الدار - المحتوى والعربية";
  readonly agentRole = "خبير المحتوى العربي الفاخر: يكتب، يوحد نبرة، يفرض هوية، يصقل نصوص";

  readonly capabilities: QayyimAgentCapabilities = {
    canAudit: false,
    canDraft: true,
    canPublish: false, // Only Core publishes
    canRollback: false,
    canAnalyze: true, // Text analysis only
    canTest: false,
    allowedTools: [
      "qayyim_draft_room",     // Draft room/product copy
      "section_update",        // Update section content
      "setting_update",        // Update site settings (text)
      "content_update",        // General content update
      "qayyim_out_of_scope",   // Delegate out of scope
    ],
    forbiddenTools: [
      "backup_create", "backup_restore", "mfg_job_create", "bom_calculate",
      "security_audit_keys", "financial_margins_analyze", "deploy_trigger",
      "project_evolve", "inventory_update", "mfg_inventory_list",
      "mfg_stock_adjust", "mfg_orders_list", "lead_list", "lead_dossier_send",
      "room_update", "seo_analyze", "seo_fix_issues", "speed_analyze",
      "speed_optimize", "speed_deep_audit", "metrics_realtime", "revenue_analyze",
      "curated_images", "web_search", "browser_research", "read_website",
    ],
    dataSources: [
      "room_sections", "products", "site_sections", "site_settings", "qayyim_drafts"
    ],
  };

  readonly systemPrompt = QAYYIM_CONT_SYSTEM_PROMPT;

  /**
   * Draft luxury copy for a page section
   */
  async draftCopy(params: {
    pagePath: string;           // '/', '/rooms/living-room', '/furniture'
    sectionKey: string;         // 'hero', 'rooms-grid', 'trust-section', 'product-card:master-bed'
    draftType: 'hero_text' | 'section_reorder' | 'product_card' | 'tone_unification' | 'identity_fix' | 'storytelling';
    currentContent?: any;       // Current content (auto-fetched if not provided)
    instructions: string;       // User instructions in Arabic
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: params.draftType,
      title: `مسودة ${this.getDraftTypeLabel(params.draftType)} لـ ${params.sectionKey}`,
      description: params.instructions,
      context: { 
        ...params.context, 
        pagePath: params.pagePath,
        sectionKey: params.sectionKey,
        currentContent: params.currentContent,
      },
      priority: "high",
    };

    const aiResult = await this.process(task);
    // Persist as real draft if AI succeeded — 100% real, no placebo
    if (aiResult.success && aiResult.data?.draftContent) {
      const targetTable = params.pagePath.startsWith('/products') ? 'products' : params.sectionKey.includes('product') ? 'products' : 'room_sections';
      // Resolve targetId via path — fallback to first visible room
      try {
        const { supabaseServer } = await import('@/lib/dal/unified-supabase');
        let targetId: string | null = null;
        let targetPath = params.pagePath;
        if (targetTable === 'room_sections') {
          const { data: room } = await supabaseServer.from('room_sections').select('id, slug').eq('slug', params.sectionKey).maybeSingle();
          if (room) { targetId = room.id; targetPath = `/#${room.slug}`; }
          else {
            const { data: anyRoom } = await supabaseServer.from('room_sections').select('id, slug').limit(1).maybeSingle();
            if (anyRoom) { targetId = anyRoom.id; targetPath = `/#${anyRoom.slug}`; }
          }
        } else {
          const { data: prod } = await supabaseServer.from('products').select('id, slug').limit(1).maybeSingle();
          if (prod) { targetId = prod.id; targetPath = prod.slug ? `/products/${prod.slug}` : '/'; }
        }
        if (targetId) {
          const draftRes = await createQayyimDraft({
            targetTable,
            targetId,
            targetPath,
            proposed: { content: aiResult.data.draftContent, sectionKey: params.sectionKey, instructions: params.instructions, type: params.draftType },
            draftType: params.draftType,
            createdBy: this.agentKey,
            companyId: params.context?.company_id ?? this.companyId,
            metadata: { via: 'ops-content', taskId, evidenceUrls: aiResult.evidenceUrls ?? [] },
          });
          if (draftRes.success && aiResult.data) {
            aiResult.data.draftId = draftRes.data?.draft_id;
            aiResult.data.previewUrl = draftRes.data?.preview_url;
          }
        }
      } catch (e) {
        console.warn('[QAYYIM-CONT] draft persist failed', e);
      }
    }
    return aiResult;
  }

  /**
   * Unify tone across entire site
   */
  async unifyTone(scope: 'full_site' | 'page' | 'section', targetPath?: string): Promise<QayyimResult> {
    const taskId = `unify_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "tone_unification",
      title: "توحيد نبرة الموقع",
      description: `وحّد النبرة في ${scope === 'full_site' ? 'الموقع كاملاً' : scope === 'page' ? `صفحة ${targetPath}` : `سكشن ${targetPath}`}`,
      context: { scope, targetPath, action: "unify" },
      priority: "high",
    };

    return this.process(task);
  }

  /**
   * Check content against Identity Law
   */
  async identityCheck(target: { pagePath?: string; sectionKey?: string; text?: string }): Promise<QayyimResult> {
    const taskId = `idcheck_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "identity_check",
      title: "فحص قانون الهوية",
      description: "افحص النص/الصفحة ضد قانون الهوية: عربي فقط، نبرة فاخرة، ممنوعات، تنسيق",
      context: { ...target, action: "check" },
      priority: "high",
    };

    return this.process(task);
  }

  /**
   * Polish existing Arabic text to luxury standard
   */
  async arabicPolish(text: string, context?: string): Promise<QayyimResult> {
    const taskId = `polish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "arabic_polish",
      title: "صقل نص عربي للفخامة",
      description: `صقل هذا النص لمستوى الفخامة: "${text.slice(0, 100)}..."`,
      context: { text, context, action: "polish" },
      priority: "medium",
    };

    return this.process(task);
  }

  /**
   * Review draft before publish
   */
  async reviewDraft(draftId: string): Promise<QayyimResult> {
    const taskId = `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "copy_review",
      title: "مراجعة مسودة قبل النشر",
      description: `راجع المسودة ${draftId}، أقر pass/fail مع أسباب`,
      context: { draftId, action: "review" },
      priority: "critical",
    };

    return this.process(task);
  }

  private getDraftTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      hero_text: "نص هيرو",
      section_reorder: "إعادة ترتيب سكشن",
      product_card: "بطاقة منتج",
      tone_unification: "توحيد نبرة",
      identity_fix: "إصلاح هوية",
      storytelling: "سرد قصة قطعة",
    };
    return labels[type] || type;
  }

  protected parseResult(taskId: string, response: string): QayyimResult {
    const base = super.parseResult(taskId, response);
    
    // Extract draft content if present
    const draftContent = this.extractDraftContent(response);
    const violations = this.extractViolations(response);
    const verdict = this.extractVerdict(response); // pass/fail

    return {
      ...base,
      data: {
        ...base.data,
        draftContent,
        violations,
        verdict,
        contentType: this.detectContentType(response),
      }
    };
  }

  private extractDraftContent(text: string): any {
    // Look for marked draft content: ```draft ... ``` or "المسودة:" ... "---"
    const patterns = [
      /```(?:draft|arabic)?\n([\s\S]*?)```/gi,
      /المسودة[:\s]\n([\s\S]*?)(?:\n---|\n\*\*|\n##|$)/gi,
      /النص المقترح[:\s]\n([\s\S]*?)(?:\n---|\n\*\*|\n##|$)/gi,
    ];
    
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  private extractViolations(text: string): Array<{ rule: string; location: string; severity: 'critical' | 'medium' | 'low'; evidenceUrl?: string }> {
    const violations: Array<{ rule: string; location: string; severity: 'critical' | 'medium' | 'low'; evidenceUrl?: string }> = [];
    
    // Pattern: "مخالفة: [rule] في [location] - [severity]"
    const violationRegex = /مخالفة[:\s]*([^-\n]+)\s*-\s*([^-\n]+)\s*-\s*(critical|medium|low)/gi;
    let match;
    while ((match = violationRegex.exec(text)) !== null) {
      violations.push({
        rule: match[1].trim(),
        location: match[2].trim(),
        severity: match[3].trim() as 'critical' | 'medium' | 'low',
      });
    }
    return violations;
  }

  private extractVerdict(text: string): 'pass' | 'fail' | 'conditional' | null {
    const lower = text.toLowerCase();
    if (lower.includes("pass") || lower.includes("ناجح") || lower.includes("مقبول") || lower.includes("✅")) return 'pass';
    if (lower.includes("fail") || lower.includes("مرفوض") || lower.includes("فشل") || lower.includes("❌")) return 'fail';
    if (lower.includes("conditional") || lower.includes("بشرط") || lower.includes("⚠️")) return 'conditional';
    return null;
  }

  private detectContentType(text: string): string {
    if (text.includes("هيرو") || text.includes("hero")) return "hero_text";
    if (text.includes("منتج") || text.includes("product_card")) return "product_card";
    if (text.includes("سرد") || text.includes("storytelling")) return "storytelling";
    if (text.includes("توحيد") || text.includes("unify")) return "tone_unification";
    if (text.includes("هوية") || text.includes("identity")) return "identity_fix";
    return "general";
  }
}

export const qayyimContentAgent = new QayyimContentAgent();