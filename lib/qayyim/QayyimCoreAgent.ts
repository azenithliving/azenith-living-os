/**
 * QAYYIM-CORE - قائد السرب
 * ينسق الوكلاء، يفحص الموقع شاملاً، يدير النشر والتراجع، بوابة الجودة
 */

import { QayyimAgentBase, QayyimTask, QayyimResult, QayyimAgentCapabilities } from "./QayyimAgentBase";
import { auditVisitorExperience, publishQayyimDraft, rollbackQayyimDraft } from "@/lib/qayyim-ops";
import { constitutionEngine } from "./governance/ConstitutionEngine";
import { supabaseServer } from "@/lib/dal/unified-supabase";

const QAYYIM_CORE_SYSTEM_PROMPT = `أنت قيّم الدار - القائد الأعلى لسرب أزينث.

## دورك:
أنت لا تكتب المحتوى بنفسك، ولا تختار الصور، ولا تفحص السيو. دورك: **التنسيق والإشراف**.
1) تفكيك طلب المستخدم لمهام فرعية دقيقة
2) توجيه كل مهمة للوكيل المختص (content, visual, seo, ux, analytics, dev, qa)
3) جمع النتائج وتوحيدها في مسودة واحدة متماسكة
4) عرض المسودة للموافقة مع evidenceUrls لكل تغيير
5) تنفيذ النشر أو التراجع بعد الموافقة

## قوانينك المطلقة (غير قابلة للكسر):
- **لا تلمس**: API، سيرفر، مخزن، عملاء، أرباح، مفاتيح، تعلم وكلاء آخرين
- **لا تنشر** بلا موافقة بشرية صريحة (approved_by != null)
- **كل ملاحظة** يجب أن تحتوي evidenceUrl يفتح الصفحة على العيب
- **لا أرقام** من خيالك، لا إدعاءات بلا مصدر
- إذا طُلب منك ما خارج اختصاصك: وجه الطلب للوكلاء المختصين صراحة
- إذا لم تستطع التنفيذ: قل "مش قادر على الصفحة دي" مش تخترع

## الوكلاء تحت إمرتك:
- **qayyim-cont**: المحتوى والعربية الفاخرة (يكتب، يوحد نبرة، يفرض هوية)
- **qayyim-vis**: المرئي والصور (يختار صور، يتحقق علامة تجارية)
- **qayyim-seo**: الظهور والبحث (يفحص تقني، يصلح schema، فجوات محتوى)
- **qayyim-ux**: تجربة المستخدم (يقيس خروج، يحلل أنفاق، يقترح A/B)
- **qayyim-ana**: التحليلات والأعمال (يربط تحويل بإيرادات، يتنبأ)
- **qayyim-dev**: التطوير والأداء (يراجع كود، يفحص bundle، بوابة جودة)
- **qayyim-qa**: الجودة والاختبار (E2E، visual regression، accessibility)

## أسلوبك:
- عربي فصحى مبسطة، فاخرة، حاسمة، موثوقة
- لا تعتذر، لا تشرح كثيراً، تنفذ وتبلغ النتيجة
- في الشات: مختصر، في التقارير: مفصل مع evidenceUrls`;

export class QayyimCoreAgent extends QayyimAgentBase {
  readonly agentKey = "qayyim-core";
  readonly agentName = "قيّم الدار - القائد";
  readonly agentRole = "قائد سرب القيّم: تنسيق، تدقيق شامل، إدارة نشر/تراجع، بوابة جودة";

  readonly capabilities: QayyimAgentCapabilities = {
    canAudit: true,
    canDraft: false, // Core doesn't draft, it coordinates
    canPublish: true, // Only Core can trigger publish after approval
    canRollback: true, // Only Core can trigger rollback
    canAnalyze: true, // High-level analysis
    canTest: false,
    allowedTools: [
      "qayyim_audit",           // Full site audit
      "qayyim_list_rooms",      // List public rooms
      "qayyim_list_products",   // List storefront products
      "qayyim_publish_draft",   // Publish approved draft
      "qayyim_out_of_scope",    // Delegate to other agents
      "content_update",         // For coordinated updates
      "section_update",
      "setting_update",
    ],
    forbiddenTools: [
      "backup_create", "backup_restore", "mfg_job_create",
      "bom_calculate", "security_audit_keys", "financial_margins_analyze",
      "deploy_trigger", "project_evolve", "inventory_update",
      "mfg_inventory_list", "mfg_stock_adjust", "mfg_orders_list",
      "lead_list", "lead_dossier_send", "room_update",
      "seo_fix_issues", "speed_optimize", "speed_deep_audit",
    ],
    dataSources: [
      "room_sections", "products", "site_sections", 
      "site_settings", "qayyim_drafts", "visitor_telemetry"
    ],
  };

  readonly systemPrompt = QAYYIM_CORE_SYSTEM_PROMPT;

  /**
   * Main coordination entry point
   */
  async coordinate(userRequest: string, context?: Record<string, any>): Promise<QayyimResult> {
    const taskId = `coord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "swarm_coordination",
      title: "تنسيق السرب لطلب المستخدم",
      description: userRequest,
      context: { ...context, userRequest },
      priority: "high",
    };

    return this.process(task);
  }

  /**
   * Full site audit - delegates to specialists then aggregates
   */
  /**
   * Full site audit - runs real DB audit then synthesizes with AI
   */
  async auditFullSite(context?: Record<string, any>): Promise<QayyimResult> {
    const taskId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // 1. Fetch real DB data for visitor experience
    const rawAudit = await auditVisitorExperience(context?.company_id);
    const issues = (rawAudit.data?.issues || []) as any[];
    const evidenceUrls = issues.map((i) => i.path).filter(Boolean);

    // 2. Synthesize findings into authoritative luxury report
    const task: QayyimTask = {
      id: taskId,
      type: "full_site_audit",
      title: "تدقيق شامل للموقع",
      description: `افحص المعطيات الميدانية التالية وصغ تقريراً تنفيذياً فاخراً مع evidenceUrls:
عدد الغرف الظاهرة: ${rawAudit.data?.visible_rooms || 0}/${rawAudit.data?.total_rooms || 0}
عدد المنتجات الظاهرة: ${rawAudit.data?.visible_products || 0}/${rawAudit.data?.total_products || 0}
الملاحظات المكتشفة (${issues.length}):
${issues.slice(0, 10).map((iss, idx) => `${idx + 1}. [${iss.kind}] ${iss.target}: ${iss.detail} (رابط: ${iss.path})`).join('\n')}`,
      context: { ...context, rawAudit: rawAudit.data },
      priority: "high",
    };

    const aiResult = await this.process(task);
    return {
      ...aiResult,
      evidenceUrls: Array.from(new Set([...evidenceUrls, ...(aiResult.evidenceUrls || [])])),
      data: {
        ...aiResult.data,
        rawAudit: rawAudit.data,
        issuesCount: issues.length,
      },
    };
  }

  /**
   * Publish approved draft - Enforces Constitutional Human Approval and updates DB
   */
  async publishDraft(draftId: string, approvedBy: string): Promise<QayyimResult> {
    const taskId = `publish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // 1. Constitutional Check: Human approval must be present
    const approvalCheck = await constitutionEngine.checkBlocking({
      agentKey: this.agentKey,
      actionType: "publish",
      humanApproval: Boolean(approvedBy),
      approvedBy,
    });

    if (!approvalCheck.passed) {
      return {
        success: false,
        taskId,
        output: `⛔ حظر دستوري: لا يمكن النشر دون موافقة بشرية معتمدة. المخالفات:\n${approvalCheck.violations.map(v => `- ${v.message}`).join('\n')}`,
      };
    }

    // 2. Execute real database publish
    const publishResult = await publishQayyimDraft(draftId, approvedBy);
    if (!publishResult.success) {
      return {
        success: false,
        taskId,
        output: `⚠️ فشل النشر الميداني: ${publishResult.message}`,
        data: publishResult.data,
      };
    }

    return {
      success: true,
      taskId,
      output: `👑 **تم النشر بنجاح على الموقع الحي**
- **رقم المسودة**: \`${draftId.slice(0, 8)}\`
- **الإصدار المنشور**: \`v${publishResult.data?.version || 1}\`
- **الهدف**: \`${publishResult.data?.target_table}\` (${publishResult.data?.target_path || '/'})
- **المعتمد**: ${approvedBy}
- **حالة الكاش**: تم تحديث الكاش الفوري (Revalidated)`,
      data: publishResult.data,
      nextActions: ["معاينة الصفحة على الموقع الحي", "التحقق من معدلات التفاعل"],
    };
  }

  /**
   * Rollback to previous version - Executes DB rollback and revalidates cache
   */
  async rollbackDraft(draftId: string, targetVersion?: number): Promise<QayyimResult> {
    const taskId = `rollback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const rollbackResult = await rollbackQayyimDraft(draftId, targetVersion);
    if (!rollbackResult.success) {
      return {
        success: false,
        taskId,
        output: `⚠️ فشل التراجع: ${rollbackResult.message}`,
      };
    }

    return {
      success: true,
      taskId,
      output: `↩️ **تم التراجع بنجاح**
- **المسودة**: \`${draftId.slice(0, 8)}\`
- **النسخة المستعادة**: \`v${rollbackResult.data?.restored_version}\`
- **الموقع الحي**: تم استرجاع النسخة السابقة وتحديث الكاش الفوري.`,
      data: rollbackResult.data,
    };
  }

  /**
   * Quality gate - runs before any publish
   */
  async qualityGate(draftId: string): Promise<QayyimResult> {
    const taskId = `qgate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const { data: draft } = await supabaseServer
      .from("qayyim_drafts")
      .select("*")
      .eq("id", draftId)
      .maybeSingle();

    if (!draft) {
      return {
        success: false,
        taskId,
        output: `⚠️ تعذر العثور على المسودة رقم ${draftId} لفحص بوابة الجودة.`,
      };
    }

    const report = await constitutionEngine.checkAll({
      agentKey: this.agentKey,
      actionType: "publish",
      content: draft.proposed,
      proposedChanges: draft.proposed,
      targetPage: draft.target_path,
      evidenceUrls: [draft.target_path],
      humanApproval: Boolean(draft.approved_by),
      approvedBy: draft.approved_by || undefined,
    });

    return {
      success: report.overallPassed,
      taskId,
      output: `🛡️ **نتيجة بوابة الجودة (Quality Gate):**
- **النتيجة**: ${report.overallPassed ? '✅ ناجح (PASSED)' : '❌ غير مستوفٍ (FAILED)'}
- **درجة الامتثال**: ${Math.round(report.overallScore * 100)}%
${report.summary}`,
      data: {
        passed: report.overallPassed,
        score: report.overallScore,
        violations: report.results.flatMap(r => r.violations),
        warnings: report.results.flatMap(r => r.warnings),
      },
    };
  }

  protected parseResult(taskId: string, response: string): QayyimResult {
    const base = super.parseResult(taskId, response);
    
    // Core-specific parsing: look for delegation instructions
    const delegations = this.extractDelegations(response);
    
    return {
      ...base,
      data: {
        ...base.data,
        delegations,
        coordinationType: this.detectCoordinationType(response),
      }
    };
  }

  private extractDelegations(text: string): Array<{ agent: string; task: string; reason: string }> {
    const delegations: Array<{ agent: string; task: string; reason: string }> = [];
    // Pattern: "أوجه لـ qayyim-seo: افحص السيو" or "delegate to qayyim-cont: اكتب الهيرو"
    const patterns = [
      /أوجه\s+لـ\s+(qayyim-\w+)\s*[:：]\s*([^\n]+)/gi,
      /delegate\s+to\s+(qayyim-\w+)\s*[:：]\s*([^\n]+)/gi,
      /(qayyim-\w+)\s*[:：]\s*(افحص|اكتب|حلل|اختر|راجع|أصلح)\s*([^\n]+)/gi,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        delegations.push({
          agent: match[1],
          task: (match[2] || match[3] || '').trim(),
          reason: 'من تنسيق القيّم-القائد'
        });
      }
    }
    return delegations;
  }

  private detectCoordinationType(text: string): string {
    if (text.includes("تدقيق") || text.includes("أفحص")) return "audit";
    if (text.includes("مسودة") || text.includes("أعد")) return "draft_coordination";
    if (text.includes("انشر") || text.includes("نشر")) return "publish_coordination";
    if (text.includes("ارجع") || text.includes("تراجع")) return "rollback_coordination";
    return "general_coordination";
  }
}

export const qayyimCoreAgent = new QayyimCoreAgent();