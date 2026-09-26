/**
 * QAYYIM-DEV - التطوير والأداء
 * يراجع الكود، يفحص Bundle، يفحص تبعيات، بوابة جودة الكود
 */

import { QayyimAgentBase, QayyimTask, QayyimResult, QayyimAgentCapabilities } from "./QayyimAgentBase";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";

const QAYYIM_DEV_SYSTEM_PROMPT = `أنت قيّم الدار - التطوير والأداء.

## تخصصك الوحيد:
الكود النظيف والأداء التقني. لا نصوص، لا صور، لا سيو، لا تحليل أموال.

## مهامك:
1. **مراجعة الكود (Code Review)**: TypeScript strictness، unused code، patterns، security
2. **تحليل Bundle**: Bundle size، code splitting، tree shaking، dependencies
3. **فحص التبعيات (Dependency Audit)**: vulnerabilities، outdated، unused، license compliance
4. **Core Web Vitals تقني**: LCP، TBT، CLS من منظور الكود (مش سيو)
5. **Type Safety**: strict mode، any usage، type coverage
6. **Security Code Scan**: XSS، injection، secrets في الكود، CSP

## أدواتك المسموحة:
system_health_check, speed_deep_audit, project_evolve (staging فقط), ops_out_of_scope

## ممنوع عليك منعاً باتاً:
- لمس API الإنتاج (Coder يفعل)
- نشر إنتاج (Core يفعل بعد QA)
- كتابة نصوص (Content يفعل)
- صور (Visual يفعل)
- سيو (SEO يفعل)
- تحليل أموال (Analytics يفعل)

## مخرجاتك:
- تقرير Code Quality مع evidenceUrls (GitHub links للخطوط)
- Bundle analysis: size، largest chunks، optimization opportunities
- Dependency report: vulnerabilities count، outdated packages، unused
- Performance budgets: هل LCP < 2.5s؟ TBT < 200ms؟ CLS < 0.1؟
- Security findings مع severity و file:line references`;

export class QayyimDevAgent extends QayyimAgentBase {
  readonly agentKey = "ops-dev";
  readonly agentName = "قيّم الدار - التطوير والأداء";
  readonly agentRole = "خبير الكود والأداء: يراجع كود، يفحص Bundle، تبعيات، بوابة جودة كود";

  readonly capabilities: QayyimAgentCapabilities = {
    canAudit: true,
    canDraft: false,
    canPublish: false,
    canRollback: false,
    canAnalyze: true,
    canTest: false,
    allowedTools: [
      "system_health_check",    // System health
      "speed_deep_audit",       // Deep performance audit
      "project_evolve",         // Staging only - code changes via PR
      "ops_out_of_scope",    // Delegate
    ],
    forbiddenTools: [
      "ops_draft_room", "section_update", "setting_update", "content_update",
      "backup_create", "backup_restore", "mfg_job_create", "bom_calculate",
      "security_audit_keys", "financial_margins_analyze", "deploy_trigger",
      "inventory_update", "mfg_inventory_list", "mfg_stock_adjust", "mfg_orders_list",
      "lead_list", "lead_dossier_send", "room_update", "seo_analyze", "seo_fix_issues",
      "speed_analyze", "speed_optimize", "metrics_realtime", "revenue_analyze",
      "curated_images", "ops_audit", "ops_list_rooms", "ops_list_products",
      "ops_publish_draft",
    ],
    dataSources: [
      "GitHub repo (via project_evolve)", "package.json", "tsconfig.json",
      "next.config.js", "webpack/bundle analyzer", "npm audit", "snyk/dependabot"
    ],
  };

  readonly systemPrompt = QAYYIM_DEV_SYSTEM_PROMPT;

  /**
   * Code quality review
   */
  async codeReview(params: {
    scope: 'full' | 'changed_files' | 'specific_paths';
    paths?: string[]; // Specific files/dirs to review
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `codereview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "code_review",
      title: `مراجعة كود ${params.scope}`,
      description: `راجع: TypeScript strictness، unused code، security patterns، performance patterns${params.paths ? ` في ${params.paths.join(', ')}` : ''}`,
      context: { ...params.context, ...params, action: "code_review" },
      priority: "high",
    };

    return this.process(task);
  }

  /**
   * Bundle analysis
   */
  async bundleAnalysis(params: {
    includeChunks?: boolean;
    thresholdKB?: number; // Only report chunks > threshold
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `bundle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "bundle_analysis",
      title: "تحليل Bundle Size",
      description: `حلل bundle: total size، largest chunks، code splitting، tree shaking${params.thresholdKB ? ` (أكبر من ${params.thresholdKB}KB)` : ''}`,
      context: { ...params.context, ...params, action: "bundle_analysis" },
      priority: "medium",
    };

    const aiResult = await this.process(task);
    if (aiResult.success) {
      try {
        const supabase = getSupabaseAdminClient();
        const companyId = await resolveAdminCompanyId(params.context?.company_id) ?? this.companyId;
        const scoreMatch = aiResult.output.match(/(\d+)\s*KB/);
        const score = scoreMatch ? Math.max(0, 100 - Math.round(parseInt(scoreMatch[1]) / 10)) : 75;
        if (supabase) {
          await supabase.from('qayyim_benchmark_runs').insert({
            company_id: companyId,
            agent_key: this.agentKey,
            benchmark_key: 'bundle_size',
            score,
            max_score: 100,
            passed: score >= 70,
            details: { bundleStats: aiResult.data?.bundleStats, output: aiResult.output.slice(0, 500) },
          });
          await supabase.from('qayyim_task_metrics').insert({
            company_id: companyId,
            agent_key: this.agentKey,
            task_id: taskId,
            task_type: 'bundle_analysis',
            status: 'completed',
            duration_ms: 1000,
            quality_gate_result: score >= 70 ? 'passed' : 'failed',
            metadata: { score },
          });
        }
      } catch (e) { console.warn('[QAYYIM-DEV] persist failed', e); }
    }
    return aiResult;
  }

  /**
   * Dependency audit
   */
  async dependencyAudit(params: {
    checkVulnerabilities?: boolean;
    checkOutdated?: boolean;
    checkUnused?: boolean;
    checkLicenses?: boolean;
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `depaudit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "dependency_audit",
      title: "فحص التبعيات",
      description: `فحص: ${params.checkVulnerabilities ? 'ثغرات' : ''}${params.checkOutdated ? ' قديمة' : ''}${params.checkUnused ? ' غير مستخدمة' : ''}${params.checkLicenses ? ' تراخيص' : ''}`,
      context: { ...params.context, ...params, action: "dependency_audit" },
      priority: "high",
    };

    return this.process(task);
  }

  /**
   * Performance budgets check
   */
  async performanceBudgets(params: {
    budgets?: { lcp?: number; tbt?: number; cls?: number; fid?: number; fcp?: number };
    pagePath?: string;
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `perfbudget_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const budgets = params.budgets || { lcp: 2500, tbt: 200, cls: 0.1, fid: 100, fcp: 1800 };
    
    const task: QayyimTask = {
      id: taskId,
      type: "performance_budgets",
      title: "فحص ميزانيات الأداء",
      description: `تحقق: LCP < ${budgets.lcp}ms، TBT < ${budgets.tbt}ms، CLS < ${budgets.cls}${params.pagePath ? ` لـ ${params.pagePath}` : ''}`,
      context: { ...params.context, ...params, budgets, action: "performance_budgets" },
      priority: "critical",
    };

    return this.process(task);
  }

  /**
   * Security code scan
   */
  async securityCodeScan(params: {
    checkXSS?: boolean;
    checkInjection?: boolean;
    checkSecrets?: boolean;
    checkCSP?: boolean;
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `seccode_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "security_code_scan",
      title: "فحص أمان الكود",
      description: `افحص: ${params.checkXSS ? 'XSS' : ''}${params.checkInjection ? ' Injection' : ''}${params.checkSecrets ? ' Secrets' : ''}${params.checkCSP ? ' CSP' : ''}`,
      context: { ...params.context, ...params, action: "security_code_scan" },
      priority: "critical",
    };

    return this.process(task);
  }

  protected parseResult(taskId: string, response: string): QayyimResult {
    const base = super.parseResult(taskId, response);
    
    const findings = this.extractFindings(response);
    const bundleStats = this.extractBundleStats(response);
    const depStats = this.extractDepStats(response);
    const perfResults = this.extractPerfResults(response);

    return {
      ...base,
      data: {
        ...base.data,
        findings,
        bundleStats,
        depStats,
        perfResults,
      }
    };
  }

  private extractFindings(text: string): Array<{
    file: string;
    line: number;
    column?: number;
    rule: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    message: string;
    suggestion?: string;
    githubUrl?: string;
  }> {
    const findings: Array<any> = [];
    
    // Pattern: "src/components/Hero.tsx:45:10 - @typescript-eslint/no-explicit-any - high - استخدم نوع محدد"
    const pattern = /([^\s:\n]+\.(?:ts|tsx|js|jsx)):(\d+)(?::(\d+))?\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*(critical|high|medium|low|info)\s*[-–—]\s*([^\n]+)(?:\s*[-–—]\s*([^\n]+))?/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      findings.push({
        file: match[1].trim(),
        line: parseInt(match[2]),
        column: parseInt(match[3] || '0'),
        rule: match[4].trim(),
        severity: match[5].trim() as 'critical' | 'high' | 'medium' | 'low' | 'info',
        message: match[6].trim(),
        suggestion: match[7]?.trim(),
        githubUrl: `https://github.com/.../blob/main/${match[1].trim()}#L${match[2]}`,
      });
    }
    return findings;
  }

  private extractBundleStats(text: string): {
    totalSizeKB: number;
    gzippedSizeKB: number;
    chunkCount: number;
    largestChunks: Array<{ name: string; sizeKB: number; gzippedKB: number }>;
  } | null {
    const totalMatch = text.match(/(?:total size|الحجم الكلي)[:\s]*(\d+(?:\.\d+)?)\s*KB/i);
    const gzipMatch = text.match(/(?:gzipped|مضغوط)[:\s]*(\d+(?:\.\d+)?)\s*KB/i);
    const chunksMatch = text.match(/(?:chunks|القطع)[:\s]*(\d+)/i);
    
    if (!totalMatch) return null;
    
    const largestChunks: Array<any> = [];
    const chunkPattern = /(?:chunk|قطعة)[:\s]*([^:\n]+)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*KB\s*[-–—]\s*(\d+(?:\.\d+)?)\s*KB/gi;
    let match;
    while ((match = chunkPattern.exec(text)) !== null) {
      largestChunks.push({
        name: match[1].trim(),
        sizeKB: parseFloat(match[2]),
        gzippedKB: parseFloat(match[3]),
      });
    }
    
    return {
      totalSizeKB: parseFloat(totalMatch[1]),
      gzippedSizeKB: parseFloat(gzipMatch?.[1] || '0'),
      chunkCount: parseInt(chunksMatch?.[1] || '0'),
      largestChunks,
    };
  }

  private extractDepStats(text: string): {
    total: number;
    vulnerabilities: { critical: number; high: number; moderate: number; low: number };
    outdated: number;
    unused: number;
    licenseIssues: number;
  } | null {
    if (!text.includes('dependency') && !text.includes('تبعية')) return null;
    
    return {
      total: this.extractNumber(text, /(?:total|إجمالي)[:\s]*(\d+)/i) || 0,
      vulnerabilities: {
        critical: this.extractNumber(text, /(?:critical|حرج)[:\s]*(\d+)/i) || 0,
        high: this.extractNumber(text, /(?:high|عالي)[:\s]*(\d+)/i) || 0,
        moderate: this.extractNumber(text, /(?:moderate|متوسط)[:\s]*(\d+)/i) || 0,
        low: this.extractNumber(text, /(?:low|منخفض)[:\s]*(\d+)/i) || 0,
      },
      outdated: this.extractNumber(text, /(?:outdated|قديمة)[:\s]*(\d+)/i) || 0,
      unused: this.extractNumber(text, /(?:unused|غير مستخدمة)[:\s]*(\d+)/i) || 0,
      licenseIssues: this.extractNumber(text, /(?:license|ترخيص)[:\s]*(\d+)/i) || 0,
    };
  }

  private extractPerfResults(text: string): Array<{
    metric: string;
    value: number;
    budget: number;
    status: 'pass' | 'fail' | 'warning';
    evidenceUrl: string;
  }> {
    const results: Array<any> = [];
    
    const pattern = /(LCP|TBT|CLS|FID|FCP)[:\s]*(\d+(?:\.\d+)?)\s*ms?\s*[-–—]\s*budget\s*(\d+(?:\.\d+)?)\s*[-–—]\s*(pass|fail|warning)\s*[-–—]\s*(https?:\/\/[^\s\n]+)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      results.push({
        metric: match[1],
        value: parseFloat(match[2]),
        budget: parseFloat(match[3]),
        status: match[4] as 'pass' | 'fail' | 'warning',
        evidenceUrl: match[5].trim(),
      });
    }
    return results;
  }

  private extractNumber(text: string, regex: RegExp): number | null {
    const match = regex.exec(text);
    return match ? parseInt(match[1].replace(',', '')) : null;
  }
}

export const qayyimDevAgent = new QayyimDevAgent();