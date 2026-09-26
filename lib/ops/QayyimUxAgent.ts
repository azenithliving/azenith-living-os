/**
 * QAYYIM-UX - تجربة المستخدم
 * يقيس معدلات الخروج، يحلل الأنفاق، يقترح A/B tests، يربط السلوك بالتعديلات
 */

import { QayyimAgentBase, QayyimTask, QayyimResult, QayyimAgentCapabilities } from "./QayyimAgentBase";
import { createQayyimDraft } from "@/lib/qayyim-ops";

const QAYYIM_UX_SYSTEM_PROMPT = `أنت قيّم الدار - تجربة المستخدم.

## تخصصك الوحيد:
سلوك الزائر الحقيقي (مش آراء، أرقام). تقرأ: scroll_depth، exit_rate، time_on_section، hover_duration، click_through من TelemetryTracker.

## مهامك:
1. **تحليل الأنفاق (Funnel Analysis)**: أين يخرج الزوار؟ كل سكشن exit rate
2. **تحليل التمرير (Scroll Depth)**: إلى أي مدى يصلون؟ أين يتوقفون؟
3. **معدلات الخروج (Exit Rate)**: كل صفحة/سكشن exit rate، مقارنة بالمعدل
4. **خرائط الحرارة (Heatmaps)**: hover_duration، click_through من useImageTracking
5. **A/B Testing**: تصميم اختبارات، قياس، قرار
6. **اقتراحات مبنية على الأدلة**: "سكشن الهيرو خروج 68% (المعدل 45%) → أقترح: اختصر النص، غير الصورة، أضف CTA واضح"

## أدواتك المسموحة:
metrics_realtime, goal_create, goal_check_progress, ops_out_of_scope

## ممنوع عليك منعاً باتاً:
- كتابة نصوص (للقيّم-المحتوى)
- صور (للقيّم-المرئي)
- سيو (للقيّم-السيو)
- كود/باكند (للقيّم-التطوير)
- تحليل إيرادات (للقيّم-التحليلات)

## مخرجاتك:
- تقرير سلوك مع evidenceUrls (روابط للسكشنات المقاسة)
- رسوم بيانية ASCII للنفق ومعدلات الخروج
- اقتراحات A/B test مع فرضية، مقياس نجاح، مدة
- ربط كل اقتراح برقم: "هذا التغيير سيرفع التحويل X% بناءً على نمط Y"`;

export class QayyimUxAgent extends QayyimAgentBase {
  readonly agentKey = "ops-ux";
  readonly agentName = "قيّم الدار - تجربة المستخدم";
  readonly agentRole = "خبير سلوك الزائر: يقيس خروج، يحلل أنفاق، يقترح A/B، يربط سلوك بتعديلات";

  readonly capabilities: QayyimAgentCapabilities = {
    canAudit: true,
    canDraft: false,
    canPublish: false,
    canRollback: false,
    canAnalyze: true,
    canTest: true, // A/B test design
    allowedTools: [
      "metrics_realtime",       // Real telemetry data
      "goal_create",            // Create conversion goals
      "goal_check_progress",    // Check goal progress
      "ops_out_of_scope",    // Delegate
    ],
    forbiddenTools: [
      "ops_draft_room", "section_update", "setting_update", "content_update",
      "backup_create", "backup_restore", "mfg_job_create", "bom_calculate",
      "security_audit_keys", "financial_margins_analyze", "deploy_trigger",
      "project_evolve", "inventory_update", "mfg_inventory_list",
      "mfg_stock_adjust", "mfg_orders_list", "lead_list", "lead_dossier_send",
      "room_update", "seo_analyze", "seo_fix_issues", "speed_analyze",
      "speed_optimize", "speed_deep_audit", "revenue_analyze", "curated_images",
    ],
    dataSources: [
      "visitor_telemetry", "TelemetryTracker hook", "useImageTracking hook",
      "qayyim_drafts", "experiments table"
    ],
  };

  readonly systemPrompt = QAYYIM_UX_SYSTEM_PROMPT;

  /**
   * Analyze visitor behavior for a page/section
   */
  async analyzeBehavior(params: {
    pagePath?: string;
    sectionKey?: string; // 'hero', 'rooms-grid', 'trust-section', etc.
    timeRange?: '1h' | '24h' | '7d' | '30d';
    metrics?: ('exit_rate' | 'scroll_depth' | 'time_on_section' | 'hover_duration' | 'click_through' | 'conversion_rate')[];
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `ux_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "behavior_analysis",
      title: `تحليل سلوك لـ ${params.pagePath || 'الموقع'}${params.sectionKey ? ` (${params.sectionKey})` : ''}`,
      description: `حلل: ${params.metrics?.join('، ') || 'exit_rate, scroll_depth, time_on_section'} خلال ${params.timeRange || '7d'}`,
      context: { ...params.context, ...params, action: "analyze" },
      priority: "high",
    };

    return this.process(task);
  }

  /**
   * Design A/B test based on behavior data
   */
  async designABTest(params: {
    hypothesis: string; // "تقصير نص الهيرو سيقلل exit rate من 68% لـ 50%"
    pagePath: string;
    sectionKey: string;
    controlVersion: any; // Current version
    variantVersion: any; // Proposed version
    successMetric: string; // 'exit_rate', 'scroll_depth', 'conversion_rate'
    minimumDetectableEffect?: number; // default 10%
    durationDays?: number; // default 14
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `ab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "ab_test_design",
      title: `تصميم A/B Test لـ ${params.sectionKey}`,
      description: `الفرضية: ${params.hypothesis}. المقياس: ${params.successMetric}. المدة: ${params.durationDays || 14} يوم`,
      context: { ...params.context, ...params, action: "design_ab_test" },
      priority: "high",
    };

    const aiResult = await this.process(task);
    // Persist as real experiment — 100% real
    if (aiResult.success) {
      try {
        const { getSupabaseAdminClient } = await import('@/lib/supabase-admin');
        const { resolveAdminCompanyId } = await import('@/lib/admin-company');
        const supabase = getSupabaseAdminClient();
        const companyId = await resolveAdminCompanyId(params.context?.company_id) ?? this.companyId;
        if (supabase) {
          const expKey = `exp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
          const { data, error } = await supabase.from('qayyim_experiments').insert({
            company_id: companyId,
            experiment_key: expKey,
            hypothesis: params.hypothesis,
            page_path: params.pagePath,
            section_key: params.sectionKey,
            control_version: params.controlVersion ?? {},
            variant_version: params.variantVersion ?? {},
            success_metric: params.successMetric,
            minimum_detectable_effect: params.minimumDetectableEffect ?? 10,
            duration_days: params.durationDays ?? 14,
            status: 'draft',
            created_by: this.agentKey,
          }).select('id').single();
          if (!error && data && aiResult.data) {
            aiResult.data.experimentId = data.id;
            aiResult.data.experimentKey = expKey;
          }
        }
      } catch (e) { console.warn('[QAYYIM-UX] experiment persist failed', e); }
    }
    return aiResult;
  }

  /**
   * Create conversion goal
   */
  async createGoal(params: {
    name: string;
    targetMetric: 'exit_rate' | 'scroll_depth' | 'conversion_rate' | 'time_on_section';
    targetValue: number;
    pagePath?: string;
    sectionKey?: string;
    deadlineDays?: number;
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "goal_create",
      title: `إنشاء هدف: ${params.name}`,
      description: `الهدف: ${params.targetMetric} يصل لـ ${params.targetValue}${params.pagePath ? ` في ${params.pagePath}` : ''}${params.sectionKey ? ` (${params.sectionKey})` : ''}`,
      context: { ...params.context, ...params, action: "create_goal" },
      priority: "medium",
    };

    return this.process(task);
  }

  /**
   * Get exit rate report for all sections
   */
  async exitRateReport(params: {
    pagePath?: string;
    timeRange?: '24h' | '7d' | '30d';
    threshold?: number; // Only show sections above this exit rate
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `exit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "exit_rate_report",
      title: `تقرير معدلات الخروج`,
      description: `أظهر سكشنات الخروج العالي ${params.threshold ? ` (>${params.threshold}%)` : ''} في ${params.pagePath || 'الموقع'} خلال ${params.timeRange || '7d'}`,
      context: { ...params.context, ...params, action: "exit_report" },
      priority: "high",
    };

    return this.process(task);
  }

  protected parseResult(taskId: string, response: string): QayyimResult {
    const base = super.parseResult(taskId, response);
    
    const metrics = this.extractMetrics(response);
    const funnel = this.extractFunnel(response);
    const abTests = this.extractABTests(response);
    const recommendations = this.extractRecommendations(response);

    return {
      ...base,
      data: {
        ...base.data,
        metrics,
        funnel,
        abTests,
        recommendations,
      }
    };
  }

  private extractMetrics(text: string): Array<{ 
    section: string; 
    metric: string; 
    value: number; 
    benchmark: number; 
    status: 'good' | 'warning' | 'critical';
    evidenceUrl: string;
  }> {
    const metrics: Array<any> = [];
    
    // Pattern: "Hero: exit_rate 68% (benchmark 45%) - critical - /#hero"
    const pattern = /([^:\n]+)[:\s]*(\w+)\s*(\d+(?:\.\d+)?%)?\s*\(?benchmark\s*(\d+(?:\.\d+)?%)?\)?\s*[-–—]\s*(good|warning|critical)\s*[-–—]\s*(https?:\/\/[^\s\n]+)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      metrics.push({
        section: match[1].trim(),
        metric: match[2].trim(),
        value: parseFloat(match[3]?.replace('%', '') || '0'),
        benchmark: parseFloat(match[4]?.replace('%', '') || '0'),
        status: match[5].trim() as 'good' | 'warning' | 'critical',
        evidenceUrl: match[6].trim(),
      });
    }
    return metrics;
  }

  private extractFunnel(text: string): Array<{ step: string; visitors: number; dropoff: number; dropoffRate: string }> {
    const funnel: Array<any> = [];
    const pattern = /(?:خطوة|step|مرحلة)[:\s]*([^:\n]+)[:\s]*(\d+(?:,\d+)?)\s*زوار?\s*[-–—]\s*(\d+(?:,\d+)?)\s*تسرب\s*[-–—]\s*(\d+(?:\.\d+)?%)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      funnel.push({
        step: match[1].trim(),
        visitors: parseInt(match[2].replace(',', '')),
        dropoff: parseInt(match[3].replace(',', '')),
        dropoffRate: match[4].trim(),
      });
    }
    return funnel;
  }

  private extractABTests(text: string): Array<{ 
    hypothesis: string; 
    pagePath: string; 
    sectionKey: string; 
    successMetric: string; 
    mde: number; 
    durationDays: number;
    status: 'proposed' | 'running' | 'completed';
  }> {
    const tests: Array<any> = [];
    const pattern = /(?:A\/B|أ\/ب)[:\s]*([^-\n]+)\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*(\d+)%\s*[-–—]\s*(\d+)\s*يوم/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      tests.push({
        hypothesis: match[1].trim(),
        pagePath: match[2].trim(),
        successMetric: match[3].trim(),
        mde: parseInt(match[4]),
        durationDays: parseInt(match[5]),
        status: 'proposed',
      });
    }
    return tests;
  }

  private extractRecommendations(text: string): Array<{ 
    section: string; 
    issue: string; 
    recommendation: string; 
    expectedImpact: string; 
    evidenceUrl: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }> {
    const recs: Array<any> = [];
    const pattern = /(?:أقترح|أوصي|recommend)[:\s]*([^-\n]+)\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*(critical|high|medium|low)\s*[-–—]\s*(https?:\/\/[^\s\n]+)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      recs.push({
        section: match[1].trim(),
        issue: match[2].trim(),
        recommendation: match[3].trim(),
        priority: match[4].trim() as 'critical' | 'high' | 'medium' | 'low',
        evidenceUrl: match[5].trim(),
      });
    }
    return recs;
  }
}

export const qayyimUxAgent = new QayyimUxAgent();