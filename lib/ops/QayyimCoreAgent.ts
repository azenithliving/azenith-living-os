/**
 * OPS-LEAD - قائد السرب
 * ينسق الوكلاء، يفحص الموقع شاملاً، يدير النشر والتراجع، بوابة الجودة
 */

import { QayyimAgentBase, QayyimTask, QayyimResult, QayyimAgentCapabilities } from "./QayyimAgentBase";
import { agentLabel } from "./identity";
import { auditVisitorExperience, publishQayyimDraft, rollbackQayyimDraft } from "@/lib/qayyim-ops";
import { constitutionEngine } from "./governance/ConstitutionEngine";
import { supabaseServer } from "@/lib/dal/unified-supabase";

const QAYYIM_CORE_SYSTEM_PROMPT = `أنت ${agentLabel("ops-lead")}. مهمتك: تعطي المفيد بسرعة، بلا رغي.

## قوانينك:
- تتكلم مصري مبسط فصيح، مختصر جداً — 5 أسطر كحد أقصى + جدول
- كل ملاحظة = سطر واحد: [النوع] الهدف — الرابط — إجراء واحد
- لا تنشئ كلاماً إنشائياً، لا مقدمات طويلة، لا خواتيم
- إذا طُلب تدقيق: اعط 3-5 مشاكل موثقة فقط، كل واحدة برابط يفتح العيب
- إذا طُلب إنشاء: اعط مسودة جاهزة للنسخ، لا تشرح نظرياً
- لا أرقام وهمية، لا وعود — فقط ما رأيته في DB
- إذا لم تستطع: قل "مش قادر على الصفحة دي" بصراحة

## الوكلاء تحت إمرتك:
ops-content (يكتب) | ops-visual (صور) | ops-seo (ظهور) | ops-ux (سلوك) | ops-analytics (أرقام) | ops-dev (كود) | ops-qa (جودة)

## أسلوبك:
- مصري مبسط، مباشر، عملي — كأنك مدير تنفيذي يعطي أوامر واضحة
- في الشات: جدول + 3 أزرار جاهزة — لا تقرير 5 صفحات`;

export class QayyimCoreAgent extends QayyimAgentBase {
  readonly agentKey = "ops-lead";
  readonly agentName = agentLabel("ops-lead");
  readonly agentRole = "قائد سرب أزينث: تنسيق، تدقيق شامل، إدارة نشر/تراجع، بوابة جودة";

  readonly capabilities: QayyimAgentCapabilities = {
    canAudit: true,
    canDraft: false, // Core doesn't draft, it coordinates
    canPublish: true, // Only Core can trigger publish after approval
    canRollback: true, // Only Core can trigger rollback
    canAnalyze: true, // High-level analysis
    canTest: false,
    allowedTools: [
      "ops_audit",           // Full site audit
      "ops_list_rooms",      // List public rooms
      "ops_list_products",   // List storefront products
      "ops_publish_draft",   // Publish approved draft
      "ops_out_of_scope",    // Delegate to other agents
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

    // 2. Ask AI for ultra-concise actionable summary (5 lines max)
    if (issues.length === 0) {
      return {
        success: true,
        taskId,
        output: `✅ **الموقع نضيف — لا ملاحظات حرجة**\n- غرف ظاهرة: ${rawAudit.data?.visible_rooms || 0}/${rawAudit.data?.total_rooms || 0}\n- منتجات ظاهرة: ${rawAudit.data?.visible_products || 0}/${rawAudit.data?.total_products || 0}\n\n**التالي:** اطلب "حسّن الهيرو" أو "وحّد النبرة" وسأنفذ فوراً.`,
        evidenceUrls,
        data: { rawAudit: rawAudit.data, issues, issuesCount: 0 },
        suggestions: ["حسّن هيرو الرئيسية", "وحّد نبرة الأقسام", "اقترح صور غرف"],
      };
    }

    const task: QayyimTask = {
      id: taskId,
      type: "full_site_audit",
      title: "تقرير تنفيذي مختصر",
      description: `أمامك بيانات حقيقية من DB — صغ تقريراً مصري مبسط فصيح، مختصر جداً (5 أسطر + جدول):

غرف: ${rawAudit.data?.visible_rooms || 0}/${rawAudit.data?.total_rooms || 0} ظاهرة
منتجات: ${rawAudit.data?.visible_products || 0}/${rawAudit.data?.total_products || 0} ظاهرة
${issues.slice(0, 5).map((iss, idx) => `${idx + 1}. ${iss.detail} — ${iss.target} — ${iss.path}`).join('\n')}

المطلوب:
- سطر افتتاحي واحد: "فحصت X غرفة و Y منتج"
- جدول 3-5 صفوف: | # | المشكلة | الرابط | ماذا أفعل؟ |
- 3 اقتراحات سريعة قابلة للضغط: "أصلح وصف [الغرفة]" / "أضف صورة [الغرفة]" / "وحّد النبرة"
- لا مقدمات إنشائية، لا شعر، لا تقرير 5 فقرات
- كل رابط يفتح العيب فعلاً`,
      context: { ...context, rawAudit: rawAudit.data, issues: issues.slice(0,5) },
      priority: "high",
    };

    const aiResult = await this.process(task);
    // Force concise fallback if AI was verbose — truncate and append structured table
    const structuredTable = `\n\n**الجدول التنفيذي:**\n| # | المشكلة | الهدف | الرابط |\n|---|---|---|---|\n${issues.slice(0,5).map((iss, idx) => `| ${idx+1} | ${iss.detail} | ${iss.target} | ${iss.path} |`).join('\n')}\n\n**3 خطوات جاهزة:**\n- اكتب لي "أصلح وصف ${issues[0]?.target || 'الغرفة'}" وسأنشئ مسودة فوراً\n- اكتب "اقترح صورة" وسأختار هيرو فاخر\n- اكتب "انشر المسودة" بعد المعاينة`;
    const conciseOutput = aiResult.output.length > 1200 ? aiResult.output.slice(0, 800) + '...\n' + structuredTable : aiResult.output + structuredTable;

    return {
      success: true,
      taskId,
      output: conciseOutput,
      evidenceUrls: Array.from(new Set([...evidenceUrls, ...(aiResult.evidenceUrls || [])])),
      data: {
        ...aiResult.data,
        rawAudit: rawAudit.data,
        issues,
        issuesCount: issues.length,
      },
      suggestions: [
        `أصلح وصف ${issues[0]?.target || 'الغرفة'}`,
        `أضف صورة لـ ${issues.find(i=>i.kind.includes('image'))?.target || issues[0]?.target}`,
        `وحّد نبرة الموقع`,
      ],
      nextActions: issues.slice(0,3).map(i => `إنشاء مسودة لـ ${i.target} (${i.path})`),
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
    // Pattern: "أوجه لـ ops-seo: افحص السيو" or "delegate to ops-content: اكتب الهيرو"
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
          reason: 'من تنسيق مدير تشغيل المحتوى'
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