/**
 * QAYYIM-ANA - التحليلات والأعمال
 * يربط السلوك بالأرقام: يربط التحويل بالإيرادات، يتنبأ، يقسم العملاء، يقيس Luxury Score
 */

import { QayyimAgentBase, QayyimTask, QayyimResult, QayyimAgentCapabilities } from "./QayyimAgentBase";
import { agentLabel } from "./identity";

const QAYYIM_ANA_SYSTEM_PROMPT = `أنت ${agentLabel("ops-analytics")}.

## تخصصك الوحيد:
ربط الشكل بالمال. تحلل: أي تعديل رفع التحويل؟ أي منتج يجلب عملاء فاخرين؟ تنبؤ: "هذا الهيرو سيرفع الخروج 15%".

## مهامك:
1. **ربط التحويل بالإيرادات**: أي تعديل في الواجهة أثر على الإيرادات؟
2. **التنبؤ (Predictive)**: بناءً على أنماط تاريخية، تنبأ بتأثير التعديلات
3. **تقسيم العملاء (Segmentation)**: أي شرائح تجلب أعلى قيمة؟ أي منتجات تجلب عملاء فاخرين؟
3. **Luxury Score**: مقياس مركب: هوية (30%) + سلوك (30%) + تحويل (25%) + إيرادات (15%)
4. **Lifetime Value**: قيمة العميل مدى الحياة لكل قناة/منتج
5. **Churn Prediction**: تنبؤ بانسحاب العملاء الفاخرين

## أدواتك المسموحة:
revenue_analyze, financial_margins_analyze, metrics_realtime, lead_list, ops_out_of_scope

## ممنوع عليك منعاً باتاً:
- كتابة نصوص (لوكيل المحتوى)
- صور (لوكيل المرئيات)
- سيو (لوكيل الظهور)
- كود/باكند (لوكيل التطوير)
- تجربة مستخدم تفصيلية (لوكيل التجربة)

## مخرجاتك:
- تقارير ربط: "تعديل الهيرو v3 رفع التحويل 12% → إيرادات إضافية 2.3م/شهر"
- تنبؤات مع confidence intervals: "هذا التغيير سيرفع الإيرادات 8-15% (95% CI)"
- Luxury Score أسبوعي مع تفصيل المكونات
- تقسيم عملاء: أي شرائح تستحق استثمار أكثر؟`;

export class QayyimAnalyticsAgent extends QayyimAgentBase {
  readonly agentKey = "ops-analytics";
  readonly agentName = agentLabel("ops-analytics");
  readonly agentRole = "خبير ربط السلوك بالأرقام: يربط تحويل بإيرادات، يتنبأ، يقسم، يقيس Luxury Score";

  readonly capabilities: QayyimAgentCapabilities = {
    canAudit: false,
    canDraft: false,
    canPublish: false,
    canRollback: false,
    canAnalyze: true,
    canTest: false,
    allowedTools: [
      "revenue_analyze",           // Revenue & conversion analysis
      "financial_margins_analyze", // Margin analysis
      "metrics_realtime",          // Real-time metrics
      "lead_list",                 // Customer segmentation
      "ops_out_of_scope",       // Delegate
    ],
    forbiddenTools: [
      "ops_draft_room", "section_update", "setting_update", "content_update",
      "backup_create", "backup_restore", "mfg_job_create", "bom_calculate",
      "security_audit_keys", "deploy_trigger", "project_evolve", "inventory_update",
      "mfg_inventory_list", "mfg_stock_adjust", "mfg_orders_list",
      "lead_dossier_send", "room_update", "seo_analyze", "seo_fix_issues",
      "speed_analyze", "speed_optimize", "speed_deep_audit", "curated_images",
    ],
    dataSources: [
      "sales_orders", "payments", "leads", "bookings", "visitor_telemetry",
      "agent_goals_v2", "qayyim_drafts", "qayyim_swarm_learnings"
    ],
  };

  readonly systemPrompt = QAYYIM_ANA_SYSTEM_PROMPT;

  /**
   * Revenue correlation analysis - which UI changes drove revenue
   */
  async revenueCorrelation(params: {
    timeRange?: '7d' | '30d' | '90d';
    segmentBy?: 'page' | 'section' | 'draft_version' | 'traffic_source';
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `revcorr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "revenue_correlation",
      title: "ربط التحويل بالإيرادات",
      description: `حلل أي تعديلات واجهة أثرت على الإيرادات خلال ${params.timeRange || '30d'} مقسمة بـ ${params.segmentBy || 'draft_version'}`,
      context: { ...params.context, ...params, action: "revenue_correlation" },
      priority: "high",
    };

    return this.process(task);
  }

  /**
   * Predictive modeling for proposed changes
   */
  async predictImpact(params: {
    proposedChange: string; // "تقصير نص الهيرو، تغيير صورة، إضافة CTA"
    pagePath: string;
    sectionKey: string;
    historicalPatterns?: string[]; // Similar past changes
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `predict_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "predictive_impact",
      title: "تنبؤ تأثير التعديل المقترح",
      description: `تنبأ بتأثير: "${params.proposedChange}" على ${params.pagePath} (${params.sectionKey})`,
      context: { ...params.context, ...params, action: "predict" },
      priority: "high",
    };

    return this.process(task);
  }

  /**
   * Luxury Score calculation
   */
  async calculateLuxuryScore(params: {
    scope: 'full_site' | 'page' | 'section';
    targetPath?: string;
    weights?: { identity?: number; behavior?: number; conversion?: number; revenue?: number };
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `luxury_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const weights = params.weights || { identity: 30, behavior: 30, conversion: 25, revenue: 15 };
    
    const task: QayyimTask = {
      id: taskId,
      type: "luxury_score",
      title: `حساب Luxury Score لـ ${params.scope}`,
      description: `احسب Luxury Score: هوية ${weights.identity}% + سلوك ${weights.behavior}% + تحويل ${weights.conversion}% + إيرادات ${weights.revenue}%`,
      context: { ...params.context, ...params, weights, action: "luxury_score" },
      priority: "high",
    };

    const aiResult = await this.process(task);
    // Persist as real benchmark run — 100% real
    if (aiResult.success) {
      try {
        const { getSupabaseAdminClient } = await import('@/lib/supabase-admin');
        const { resolveAdminCompanyId } = await import('@/lib/admin-company');
        const supabase = getSupabaseAdminClient();
        const companyId = await resolveAdminCompanyId(params.context?.company_id) ?? this.companyId;
        const score = aiResult.data?.luxuryScore?.total ?? aiResult.data?.luxuryScore ?? 0;
        if (supabase && typeof score === 'number') {
          await supabase.from('qayyim_benchmark_runs').insert({
            company_id: companyId,
            agent_key: this.agentKey,
            benchmark_key: 'luxury_score',
            score: Math.round(score),
            max_score: 100,
            passed: score >= 70,
            details: { scope: params.scope, weights, luxuryScore: aiResult.data?.luxuryScore, output: aiResult.output.slice(0, 500) },
          });
        }
      } catch (e) { console.warn('[QAYYIM-ANA] benchmark persist failed', e); }
    }
    return aiResult;
  }

  /**
   * Customer segmentation for luxury buyers
   */
  async segmentLuxuryBuyers(params: {
    timeRange?: '30d' | '90d' | '1y';
    minOrderValue?: number;
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `segment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "luxury_segmentation",
      title: "تقسيم عملاء الفخامة",
      description: `قسم العملاء الذين اشتروا بأكثر من ${params.minOrderValue || 50000} ج.م في ${params.timeRange || '90d'}`,
      context: { ...params.context, ...params, action: "segmentation" },
      priority: "medium",
    };

    return this.process(task);
  }

  /**
   * Weekly luxury report
   */
  async weeklyLuxuryReport(params: {
    weekStart?: string; // ISO date
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `weekly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "weekly_report",
      title: "تقرير الفخامة الأسبوعي",
      description: `أسبوع ${params.weekStart || 'الحالي'}: Luxury Score، تغييرات الواجهة، تأثير الإيرادات، توصيات`,
      context: { ...params.context, ...params, action: "weekly_report" },
      priority: "high",
    };

    return this.process(task);
  }

  protected parseResult(taskId: string, response: string): QayyimResult {
    const base = super.parseResult(taskId, response);
    
    const correlations = this.extractCorrelations(response);
    const predictions = this.extractPredictions(response);
    const luxuryScore = this.extractLuxuryScore(response);
    const segments = this.extractSegments(response);

    return {
      ...base,
      data: {
        ...base.data,
        correlations,
        predictions,
        luxuryScore,
        segments,
      }
    };
  }

  private extractCorrelations(text: string): Array<{
    change: string;
    metric: string;
    correlation: number; // -1 to 1
    pValue: number;
    revenueImpact: string;
    evidenceUrl: string;
  }> {
    const correlations: Array<any> = [];
    
    const pattern = /(?:ارتباط|correlation)[:\s]*([^-\n]+)\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*([-\d.]+)\s*[-–—]\s*([\d.]+)\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*(https?:\/\/[^\s\n]+)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      correlations.push({
        change: match[1].trim(),
        metric: match[2].trim(),
        correlation: parseFloat(match[3]),
        pValue: parseFloat(match[4]),
        revenueImpact: match[5].trim(),
        evidenceUrl: match[6].trim(),
      });
    }
    return correlations;
  }

  private extractPredictions(text: string): Array<{
    proposedChange: string;
    predictedMetric: string;
    predictedValue: number;
    confidenceInterval: { low: number; high: number };
    confidence: number; // 0-1
    evidenceUrl: string;
  }> {
    const predictions: Array<any> = [];
    
    const pattern = /(?:تنبؤ|predict)[:\s]*([^-\n]+)\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*([\d.]+)\s*[-–—]\s*CI\s*\[([\d.]+),\s*([\d.]+)\]\s*[-–—]\s*(\d+(?:\.\d+)?)\s*[-–—]\s*(https?:\/\/[^\s\n]+)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      predictions.push({
        proposedChange: match[1].trim(),
        predictedMetric: match[2].trim(),
        predictedValue: parseFloat(match[3]),
        confidenceInterval: { low: parseFloat(match[4]), high: parseFloat(match[5]) },
        confidence: parseFloat(match[6]),
        evidenceUrl: match[7].trim(),
      });
    }
    return predictions;
  }

  private extractLuxuryScore(text: string): { 
    total: number; 
    identity: number; 
    behavior: number; 
    conversion: number; 
    revenue: number; 
    trend: 'up' | 'down' | 'stable';
    evidenceUrls: string[];
  } | null {
    const totalMatch = text.match(/(?:Luxury Score|درجة الفخامة)[:\s]*(\d+(?:\.\d+)?)/i);
    if (!totalMatch) return null;
    
    const identityMatch = text.match(/(?:هوية|identity)[:\s]*(\d+(?:\.\d+)?)/i);
    const behaviorMatch = text.match(/(?:سلوك|behavior)[:\s]*(\d+(?:\.\d+)?)/i);
    const conversionMatch = text.match(/(?:تحويل|conversion)[:\s]*(\d+(?:\.\d+)?)/i);
    const revenueMatch = text.match(/(?:إيرادات|revenue)[:\s]*(\d+(?:\.\d+)?)/i);
    const trendMatch = text.match(/(?:اتجاه|trend)[:\s]*(up|down|stable|صعود|هبوط|مستقر)/i);
    
    const urls = this.extractEvidenceUrls(text);
    
    return {
      total: parseFloat(totalMatch[1]),
      identity: parseFloat(identityMatch?.[1] || '0'),
      behavior: parseFloat(behaviorMatch?.[1] || '0'),
      conversion: parseFloat(conversionMatch?.[1] || '0'),
      revenue: parseFloat(revenueMatch?.[1] || '0'),
      trend: (trendMatch?.[1] as 'up' | 'down' | 'stable') || 'stable',
      evidenceUrls: urls,
    };
  }

  private extractSegments(text: string): Array<{
    name: string;
    count: number;
    avgOrderValue: number;
    conversionRate: number;
    lifetimeValue: number;
    characteristics: string[];
  }> {
    const segments: Array<any> = [];
    
    const pattern = /(?:شريحة|segment)[:\s]*([^-\n]+)\s*[-–—]\s*(\d+)\s*عملاء?\s*[-–—]\s*([\d,]+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?%)?\s*[-–—]\s*([\d,]+(?:\.\d+)?)\s*[-–—]\s*([^\n]+)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      segments.push({
        name: match[1].trim(),
        count: parseInt(match[2].replace(',', '')),
        avgOrderValue: parseFloat(match[3].replace(',', '')),
        conversionRate: parseFloat(match[4]?.replace('%', '') || '0'),
        lifetimeValue: parseFloat(match[5].replace(',', '')),
        characteristics: match[6].split('،').map(s => s.trim()),
      });
    }
    return segments;
  }
}

export const qayyimAnalyticsAgent = new QayyimAnalyticsAgent();