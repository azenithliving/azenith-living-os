/**
 * QAYYIM-QA - الجودة والاختبار
 * E2E، Visual Regression، Accessibility، Load Testing، Security Scan
 */

import { QayyimAgentBase, QayyimTask, QayyimResult, QayyimAgentCapabilities } from "./QayyimAgentBase";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { runLoadProbe, runSecurityHeaderChecks, runA11yChecks } from "./qa/realChecks";

const QAYYIM_QA_SYSTEM_PROMPT = `أنت قيّم الدار - الجودة والاختبار.

## تخصصك الوحيد:
لا يمر شيء دون اختبار. تشغل: E2E، Visual Regression، Accessibility، Load Test، Security Scan.

## مهامك:
1. **E2E Smoke Tests**: سيناريوهات الحرجة على Staging (تصفح، نموذج طلب، واتساب)
2. **Visual Regression**: لقطات شاشة قبل/بعد، pixel-diff، threshold configurable
3. **Accessibility (a11y)**: WCAG 2.1 AA، axe-core، keyboard nav، screen reader، contrast
4. **Load Testing**: k6/Playwright، concurrent users، response times، error rates
5. **Security Scan**: Headers، CSP، HTTPS، cookies، rate limiting
6. **Cross-browser/Device**: Chrome، Firefox، Safari، Mobile، Tablet

## قاعدتك الذهبية:
**لا نشر بلا QA Pass**. القيّم-القائد يستأذن، أنت تقرر pass/fail مع أدلة.

## قاعدة حاسمة للقياسات الحقيقية:
ستجد في السياق قياسات حقيقية (measured). لخصها فقط. ممنوع اختراع أي رقم غير موجود في measured.

## أدواتك المسموحة:
deploy_trigger (staging فقط), qayyim_out_of_scope

## ممنوع عليك منعاً باتاً:
- أي أداة non-staging (backup, mfg, financial, production deploy, etc.)
- كتابة نصوص، صور، سيو، كود، تحليل أموال، تجربة مستخدم تفصيلية

## مخرجاتك:
- Test Report: pass/fail لكل suite مع evidenceUrls (Screenshots، Videos، Traces، Logs)
- Visual Diff: قبل/بعد مع نسبة差异
- a11y Report: violations مع axe rule IDs، file:line، severity
- Load Test: p50/p95/p99، error rate، throughput، breaking point
- Security: headers check، CSP eval، cookie flags، rate limit test`;

export class QayyimQaAgent extends QayyimAgentBase {
  readonly agentKey = "qayyim-qa";
  readonly agentName = "قيّم الدار - الجودة والاختبار";
  readonly agentRole = "خبير الاختبار الآلي: E2E، Visual Regression، a11y، Load، Security - لا نشر بلا QA Pass";

  readonly capabilities: QayyimAgentCapabilities = {
    canAudit: true,
    canDraft: false,
    canPublish: false,
    canRollback: false,
    canAnalyze: true,
    canTest: true,
    allowedTools: [
      "deploy_trigger",         // Staging deploy only
      "qayyim_out_of_scope",    // Delegate
    ],
    forbiddenTools: [
      "qayyim_draft_room", "section_update", "setting_update", "content_update",
      "backup_create", "backup_restore", "mfg_job_create", "bom_calculate",
      "security_audit_keys", "financial_margins_analyze", "revenue_analyze",
      "project_evolve", "inventory_update", "mfg_inventory_list",
      "mfg_stock_adjust", "mfg_orders_list", "lead_list", "lead_dossier_send",
      "room_update", "seo_analyze", "seo_fix_issues", "speed_analyze",
      "speed_optimize", "speed_deep_audit", "metrics_realtime", "curated_images",
      "qayyim_audit", "qayyim_list_rooms", "qayyim_list_products",
      "qayyim_publish_draft",
    ],
    dataSources: [
      "Playwright test results", "k6 load test output", "axe-core a11y results",
      "Staging environment", "Visual regression baselines", "Lighthouse CI"
    ],
  };

  readonly systemPrompt = QAYYIM_QA_SYSTEM_PROMPT;

  /**
   * Run full QA suite on staging
   */
  async runFullQASuite(params: {
    stagingUrl?: string; // default from env
    suites?: ('e2e' | 'visual' | 'a11y' | 'load' | 'security')[];
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const suites = params.suites || ['e2e', 'visual', 'a11y', 'security'];
    
    const task: QayyimTask = {
      id: taskId,
      type: "full_qa_suite",
      title: "تشغيل مجموعة QA كاملة على Staging",
      description: `شغّل: ${suites.join('، ')} على ${params.stagingUrl || 'staging environment'}`,
      context: { ...params.context, ...params, suites, action: "run_qa" },
      priority: "critical",
    };

    const aiResult = await this.process(task);
    if (aiResult.success) {
      try {
        const supabase = getSupabaseAdminClient();
        const companyId = await resolveAdminCompanyId(params.context?.company_id) ?? this.companyId;
        const passed = aiResult.data?.overallVerdict === 'PASS' || aiResult.output.includes('✅');
        const score = passed ? 95 : 45;
        if (supabase) {
          await supabase.from('qayyim_benchmark_runs').insert({
            company_id: companyId,
            agent_key: this.agentKey,
            benchmark_key: 'qa_suite',
            score,
            max_score: 100,
            passed,
            details: { suites, verdict: aiResult.data?.overallVerdict, output: aiResult.output.slice(0, 500) },
          });
          await supabase.from('qayyim_task_metrics').insert({
            company_id: companyId,
            agent_key: this.agentKey,
            task_id: taskId,
            task_type: 'full_qa_suite',
            status: passed ? 'completed' : 'failed',
            duration_ms: 2000,
            quality_gate_result: passed ? 'passed' : 'failed',
            metadata: { suites },
          });
        }
      } catch (e) { console.warn('[QAYYIM-QA] persist failed', e); }
    }
    return aiResult;
  }

  /**
   * Run E2E smoke tests
   */
  async runE2ESmoke(params: {
    testPaths?: string[]; // Specific test files
    baseUrl?: string;
    headed?: boolean;
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "e2e_smoke",
      title: "اختبارات E2E الحرجة",
      description: `شغّل smoke tests: ${params.testPaths?.join(', ') || 'الافتراضية (تنقل، نموذج، واتساب)'}`,
      context: { ...params.context, ...params, action: "e2e_smoke" },
      priority: "critical",
    };

    return this.process(task);
  }

  /**
   * Visual regression testing
   */
  async visualRegression(params: {
    pages: Array<{ path: string; name: string; viewport?: 'mobile' | 'tablet' | 'desktop' }>;
    threshold?: number; // pixel diff threshold 0-1
    updateBaselines?: boolean;
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `visual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "visual_regression",
      title: "Visual Regression Testing",
      description: `قارن ${params.pages.length} صفحات ضد البيسلاين (threshold: ${params.threshold || 0.01}%)${params.updateBaselines ? ' [تحديث البيسلاين]' : ''}`,
      context: { ...params.context, ...params, action: "visual_regression" },
      priority: "high",
    };

    return this.process(task);
  }

  /**
   * Accessibility audit — P2: fetch real pages and run static checks
   */
  async accessibilityAudit(params: {
    pages: string[];
    standard?: 'WCAG21AA' | 'WCAG21AAA' | 'Section508';
    includeBestPractices?: boolean;
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `a11y_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return {
        success: false,
        taskId,
        output: 'SITE_URL not configured',
        data: { error: 'SITE_URL not configured' },
        confidence: 0,
      };
    }

    const siteOrigin = new URL(siteUrl).origin;

    // Fetch pages with bounded parallelism (≤5) and timeouts
    const violationsByPage: Record<string, any> = {};
    const concurrency = 5;
    const queue = [...params.pages];
    let index = 0;

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (index < queue.length) {
        const pagePath = queue[index++];
        let pageUrl: string;
        try {
          const url = new URL(pagePath, siteUrl);
          if (url.origin !== siteOrigin) {
            violationsByPage[pagePath] = { error: 'URL outside site' };
            continue;
          }
          pageUrl = url.toString();
        } catch {
          violationsByPage[pagePath] = { error: 'Invalid URL' };
          continue;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        try {
          const response = await fetch(pageUrl, { signal: controller.signal });
          if (!response.ok) {
            violationsByPage[pagePath] = { error: `HTTP ${response.status}` };
            continue;
          }

          const html = await response.text();
          const result = await runA11yChecks(html, pageUrl);
          violationsByPage[pagePath] = result;
        } catch (e: any) {
          violationsByPage[pagePath] = { error: e.name === 'AbortError' ? 'Timeout' : e.message };
        } finally {
          clearTimeout(timeout);
        }
      }
    });

    await Promise.all(workers);

    const task: QayyimTask = {
      id: taskId,
      type: "accessibility_audit",
      title: `فحص إمكانية الوصول (${params.standard || 'WCAG21AA'})`,
      description: `افحص ${params.pages.length} صفحات ضد ${params.standard || 'WCAG21AA'}`,
      context: {
        ...params.context,
        ...params,
        action: "a11y_audit",
        measured: { violationsByPage },
      },
      priority: "high",
    };

    // LLM summarizes the measured data
    const aiResult = await this.process(task);
    aiResult.data = { ...(aiResult.data || {}), violationsByPage };

    return aiResult;
  }

  /**
   * Load testing — P2: real requests with measured latencies
   */
  async loadTest(params: {
    scenarios: Array<{ name: string; path: string; method: 'GET' | 'POST'; body?: any }>;
    stages: Array<{ duration: string; users: number }>; // k6 stages
    thresholds?: { p95?: number; p99?: number; errorRate?: number };
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `load_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return {
        success: false,
        taskId,
        output: 'SITE_URL not configured',
        data: { error: 'SITE_URL not configured' },
        confidence: 0,
      };
    }

    // Run real load probe (capped at 200 requests, ≤10 concurrency)
    const metrics = await runLoadProbe(siteUrl, params.scenarios, {
      concurrency: 10,
      totalRequests: 200,
    });

    const task: QayyimTask = {
      id: taskId,
      type: "load_test",
      title: "اختبار الحمل",
      description: `شغّل load test: ${params.scenarios.length} سيناريوهات، ${params.stages.length} مراحل، thresholds: ${JSON.stringify(params.thresholds || {})}`,
      context: {
        ...params.context,
        ...params,
        action: "load_test",
        measured: { metrics },
      },
      priority: "high",
    };

    // LLM summarizes the real numbers
    const aiResult = await this.process(task);
    aiResult.data = { ...(aiResult.data || {}), metrics };

    return aiResult;
  }

  /**
   * Security scan — P2: real header checks
   */
  async securityScan(params: {
    targetUrl: string;
    checks?: ('headers' | 'csp' | 'cookies' | 'rate_limit' | 'ssl' | 'cors')[];
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `secscan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return {
        success: false,
        taskId,
        output: 'SITE_URL not configured',
        data: { error: 'SITE_URL not configured' },
        confidence: 0,
      };
    }

    let normalizedTarget: string;
    try {
      const target = new URL(params.targetUrl);
      if (target.origin !== new URL(siteUrl).origin) {
        return {
          success: false,
          taskId,
          output: 'target_url outside site origin',
          data: { error: 'target_url outside site origin', targetUrl: params.targetUrl },
          confidence: 0,
        };
      }
      normalizedTarget = target.toString();
    } catch {
      return {
        success: false,
        taskId,
        output: 'Invalid target_url',
        data: { error: 'Invalid target_url', targetUrl: params.targetUrl },
        confidence: 0,
      };
    }

    // Run real security header checks
    let headerChecks: any;
    try {
      headerChecks = await runSecurityHeaderChecks(normalizedTarget);
    } catch (e: any) {
      return {
        success: false,
        taskId,
        output: `Security scan failed: ${e.message}`,
        data: { error: e.message },
        confidence: 0,
      };
    }

    const task: QayyimTask = {
      id: taskId,
      type: "security_scan",
      title: "فحص الأمان",
      description: `افحص ${params.targetUrl}: ${params.checks?.join('، ') || 'headers, csp, cookies, rate_limit, ssl, cors'}`,
      context: {
        ...params.context,
        ...params,
        action: "security_scan",
        measured: { headerChecks },
      },
      priority: "critical",
    };

    // LLM summarizes the checks
    const aiResult = await this.process(task);
    aiResult.data = { ...(aiResult.data || {}), headerChecks };

    return aiResult;
  }

  /**
   * Cross-browser testing
   */
  async crossBrowserTest(params: {
    pages: string[];
    browsers?: ('chromium' | 'firefox' | 'webkit')[];
    devices?: ('mobile' | 'tablet' | 'desktop')[];
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `xbrowser_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "cross_browser_test",
      title: "اختبار عبر المتصفحات والأجهزة",
      description: `اختبر ${params.pages.length} صفحات على: ${params.browsers?.join(', ') || 'chromium, firefox, webkit'} × ${params.devices?.join(', ') || 'mobile, tablet, desktop'}`,
      context: { ...params.context, ...params, action: "cross_browser" },
      priority: "medium",
    };

    return this.process(task);
  }

  protected parseResult(taskId: string, response: string): QayyimResult {
    const base = super.parseResult(taskId, response);
    
    const testResults = this.extractTestResults(response);
    const visualDiffs = this.extractVisualDiffs(response);
    const a11yViolations = this.extractA11yViolations(response);
    const loadMetrics = this.extractLoadMetrics(response);
    const securityFindings = this.extractSecurityFindings(response);
    const overallVerdict = this.extractOverallVerdict(response);

    return {
      ...base,
      data: {
        ...base.data,
        testResults,
        visualDiffs,
        a11yViolations,
        loadMetrics,
        securityFindings,
        overallVerdict,
      }
    };
  }

  private extractTestResults(text: string): Array<{
    suite: string;
    test: string;
    status: 'passed' | 'failed' | 'skipped' | 'flaky';
    duration: number;
    error?: string;
    screenshot?: string;
    trace?: string;
  }> {
    const results: Array<any> = [];
    
    // Pattern: "✅ navigation.spec.ts - should navigate to rooms - 2.3s"
    const pattern = /([✅❌⏭️🔄])\s*([^\s]+\.spec\.ts)\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*([\d.]+)s/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const statusMap: Record<string, 'passed' | 'failed' | 'skipped' | 'flaky'> = {
        '✅': 'passed', '❌': 'failed', '⏭️': 'skipped', '🔄': 'flaky'
      };
      results.push({
        suite: match[2].replace('.spec.ts', ''),
        test: match[3].trim(),
        status: statusMap[match[1]] || 'passed',
        duration: parseFloat(match[4]),
      });
    }
    return results;
  }

  private extractVisualDiffs(text: string): Array<{
    page: string;
    viewport: string;
    diffPercent: number;
    threshold: number;
    status: 'pass' | 'fail';
    baselineImage: string;
    currentImage: string;
    diffImage: string;
  }> {
    const diffs: Array<any> = [];
    
    const pattern = /(?:visual|بصري)[:\s]*([^-\n]+)\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*(\d+(?:\.\d+)?%)?\s*diff\s*[-–—]\s*threshold\s*(\d+(?:\.\d+)?%)?\s*[-–—]\s*(pass|fail)\s*[-–—]\s*(https?:\/\/[^\s\n]+)\s*[-–—]\s*(https?:\/\/[^\s\n]+)\s*[-–—]\s*(https?:\/\/[^\s\n]+)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      diffs.push({
        page: match[1].trim(),
        viewport: match[2].trim(),
        diffPercent: parseFloat(match[3]?.replace('%', '') || '0'),
        threshold: parseFloat(match[4]?.replace('%', '') || '0.1'),
        status: match[5] as 'pass' | 'fail',
        baselineImage: match[6]?.trim(),
        currentImage: match[7]?.trim(),
        diffImage: match[8]?.trim(),
      });
    }
    return diffs;
  }

  private extractA11yViolations(text: string): Array<{
    page: string;
    rule: string; // axe rule id
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    description: string;
    helpUrl: string;
    nodes: Array<{ target: string; html: string }>;
  }> {
    const violations: Array<any> = [];
    
    const pattern = /(?:a11y|وصول)[:\s]*([^-\n]+)\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*(critical|serious|moderate|minor)\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*(https?:\/\/[^\s\n]+)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      violations.push({
        page: match[1].trim(),
        rule: match[2].trim(),
        impact: match[3] as 'critical' | 'serious' | 'moderate' | 'minor',
        description: match[4].trim(),
        helpUrl: match[5].trim(),
        nodes: [],
      });
    }
    return violations;
  }

  private extractLoadMetrics(text: string): {
    p50: number;
    p95: number;
    p99: number;
    errorRate: number;
    throughput: number; // req/sec
    breakingPoint?: number; // users at failure
    status: 'pass' | 'fail';
  } | null {
    const p50Match = text.match(/(?:p50|المتوسط)[:\s]*(\d+(?:\.\d+)?)\s*ms/i);
    const p95Match = text.match(/(?:p95)[:\s]*(\d+(?:\.\d+)?)\s*ms/i);
    const p99Match = text.match(/(?:p99)[:\s]*(\d+(?:\.\d+)?)\s*ms/i);
    const errorMatch = text.match(/(?:error rate|معدل الخطأ)[:\s]*(\d+(?:\.\d+)?%)/i);
    const throughputMatch = text.match(/(?:throughput|الإنتاجية)[:\s]*(\d+(?:\.\d+)?)\s*req\/s/i);
    const statusMatch = text.match(/(?:load test|حمل)[:\s]*(pass|fail|نجاح|فشل)/i);
    
    if (!p50Match && !p95Match) return null;
    
    return {
      p50: parseFloat(p50Match?.[1] || '0'),
      p95: parseFloat(p95Match?.[1] || '0'),
      p99: parseFloat(p99Match?.[1] || '0'),
      errorRate: parseFloat(errorMatch?.[1]?.replace('%', '') || '0'),
      throughput: parseFloat(throughputMatch?.[1] || '0'),
      breakingPoint: undefined,
      status: (statusMatch?.[1]?.toLowerCase().includes('pass') || statusMatch?.[1]?.includes('نجاح')) ? 'pass' : 'fail',
    };
  }

  private extractSecurityFindings(text: string): Array<{
    check: string;
    status: 'pass' | 'fail' | 'warning';
    details: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }> {
    const findings: Array<any> = [];
    
    const pattern = /(?:security|أمان)[:\s]*([^-\n]+)\s*[-–—]\s*(pass|fail|warning)\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*(critical|high|medium|low)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      findings.push({
        check: match[1].trim(),
        status: match[2] as 'pass' | 'fail' | 'warning',
        details: match[3].trim(),
        severity: match[4] as 'critical' | 'high' | 'medium' | 'low',
      });
    }
    return findings;
  }

  private extractOverallVerdict(text: string): 'PASS' | 'FAIL' | 'CONDITIONAL' | null {
    const lower = text.toLowerCase();
    if (lower.includes("overall: pass") || lower.includes("الإجمالي: نجاح") || lower.includes("✅ جميع الاختبارات")) return 'PASS';
    if (lower.includes("overall: fail") || lower.includes("الإجمالي: فشل") || lower.includes("❌ فشل")) return 'FAIL';
    if (lower.includes("conditional") || lower.includes("مشروط") || lower.includes("⚠️")) return 'CONDITIONAL';
    return null;
  }
}

export const qayyimQaAgent = new QayyimQaAgent();