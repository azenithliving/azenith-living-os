/**
 * QAYYIM-SEO - الظهور والبحث
 * يفحص SEO تقني، يصلح Schema، يحلل فجوات المحتوى، يراقب المنافسين
 */

import * as cheerio from "cheerio";
import { gscConfig } from "./gsc";
import { QayyimAgentBase, QayyimTask, QayyimResult, QayyimAgentCapabilities } from "./QayyimAgentBase";
import { createQayyimDraft } from "@/lib/qayyim-ops";

const QAYYIM_SEO_SYSTEM_PROMPT = `أنت قيّم الدار - الظهور والبحث.

## تخصصك الوحيد:
SEO تقني ومحتوى. لا نصوص تسويقية (للقيّم-المحتوى)، لا صور (للقيّم-المرئي)، لا كود (للقيّم-التطوير).

## مهامك:
1. **التدقيق التقني**: Schema.org، Meta tags، H1 structure، Canonical، Robots.txt، Sitemap
2. **Core Web Vitals**: LCP، TBT، CLS، FCP، SI - تقارير مع evidenceUrls
3. **فجوات المحتوى**: ما يبحث عنه الزوار ومفقود عندنا (keyword gap analysis)
4. **تحليل المنافسين**: ماذا يعمل top 3 منافسين ونحن لا (content، backlinks، technical)
4. **الإصلاحات**: meta descriptions مكررة، H1 مفقود، schema ناقص، canonical errors

## أدواتك المسموحة:
seo_analyze, seo_fix_issues, web_search, browser_research, read_website, ops_out_of_scope

## ممنوع عليك منعاً باتاً:
- كتابة نصوص عربية (للقيّم-المحتوى)
- صور (للقيّم-المرئي)
- كود/باكند (للقيّم-التطوير)
- تحليل سلوك زائر (للقيّم-التجربة)
- أي أداة: backup, mfg, financial, deploy, inventory, lead

## مخرجاتك:
- تقرير تدقيق مع evidenceUrls لكل مشكلة
- قائمة إصلاحات مرتبة بالأولوية (critical > high > medium > low)
- Schema.org JSON-LD جاهز للنسخ
- تقارير منافسين مع فرص محتوى محددة`;

export class QayyimSeoAgent extends QayyimAgentBase {
  readonly agentKey = "ops-seo";
  readonly agentName = "قيّم الدار - الظهور والبحث";
  readonly agentRole = "خبير SEO التقني والمحتوى: يفحص، يصلح Schema، يحلل فجوات، يراقب منافسين";

  readonly capabilities: QayyimAgentCapabilities = {
    canAudit: true,
    canDraft: false,
    canPublish: false,
    canRollback: false,
    canAnalyze: true,
    canTest: false,
    allowedTools: [
      "seo_analyze",          // Full SEO audit
      "seo_fix_issues",       // Auto-fix issues
      "web_search",           // Competitor/keyword research
      "browser_research",     // Deep competitor analysis
      "read_website",         // Read competitor pages
      "ops_out_of_scope",  // Delegate
    ],
    forbiddenTools: [
      "ops_draft_room", "section_update", "setting_update", "content_update",
      "backup_create", "backup_restore", "mfg_job_create", "bom_calculate",
      "security_audit_keys", "financial_margins_analyze", "deploy_trigger",
      "project_evolve", "inventory_update", "mfg_inventory_list",
      "mfg_stock_adjust", "mfg_orders_list", "lead_list", "lead_dossier_send",
      "room_update", "speed_analyze", "speed_optimize", "speed_deep_audit",
      "metrics_realtime", "revenue_analyze", "curated_images",
    ],
    dataSources: [
      "site_sections", "room_sections", "products", "site_settings", 
      gscConfig().ready ? "search_console (via API)" : "search_console (غير موصول — لا تدّعِ أنك تعرف كلمات البحث، وقول للمالك ينقص GOOGLE_APPLICATION_CREDENTIALS_JSON)", "page_speed_insights (via API)"
    ],
  };

  readonly systemPrompt = QAYYIM_SEO_SYSTEM_PROMPT;

  /**
   * Full SEO audit for a page or site
   */
  async auditSEO(params: {
    url: string;
    deepAnalysis?: boolean;
    competitorUrls?: string[];
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `seo_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return this.groundedFailure(taskId, "SITE_URL not configured");
    }

    let target: URL;
    try {
      target = new URL(params.url, siteUrl);
    } catch {
      return this.groundedFailure(taskId, "URL outside site");
    }
    const siteOrigin = new URL(siteUrl).origin;
    if (target.origin !== siteOrigin) {
      return this.groundedFailure(taskId, "URL outside site");
    }

    const evidence = await this.fetchPageEvidence(target, siteOrigin);
    if (!evidence.success) {
      return this.groundedFailure(taskId, evidence.error);
    }

    const task: QayyimTask = {
      id: taskId,
      type: "seo_audit",
      title: `تدقيق SEO لـ ${params.url}`,
      description: `افحص SEO تقني ومحتوى لـ ${params.url}${params.deepAnalysis ? ' بعمق' : ''}${params.competitorUrls?.length ? ` + ${params.competitorUrls.length} منافسين` : ''}`,
      context: { ...params.context, ...params, action: "audit", evidence: evidence.data },
      priority: "high",
    };

    const aiResult = await this.process(task);

    aiResult.data = { ...(aiResult.data || {}), evidence: evidence.data };

    const issues = Array.isArray(aiResult.data.issues) ? aiResult.data.issues : [];
    if (issues.length > 0) {
      const kept = issues.filter((issue: any) => {
        try {
          return issue?.evidenceUrl && new URL(String(issue.evidenceUrl)).origin === siteOrigin;
        } catch {
          return false;
        }
      });
      const dropped = issues.length - kept.length;
      aiResult.data.issues = kept;
      if (dropped > 0) {
        aiResult.suggestions = [...(aiResult.suggestions || []), `فلترة: ${dropped} ادعاءات بأدلة خارج النطاق حُذرت`];
      }
    }

    return aiResult;
  }

  private groundedFailure(taskId: string, error: string): QayyimResult {
    return { success: false, taskId, output: error, data: { error }, confidence: 0 };
  }

  private async fetchPageEvidence(
    target: URL,
    siteOrigin: string
  ): Promise<{ success: true; data: Record<string, any> } | { success: false; error: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let html: string;
    let fetchedUrl: string;
    try {
      const response = await fetch(target.toString(), { signal: controller.signal });
      if (!response.ok) {
        return { success: false, error: `fetch failed: HTTP ${response.status}` };
      }
      html = await response.text();
      fetchedUrl = response.url || target.toString();
    } catch (e: any) {
      return { success: false, error: `fetch failed: ${e?.message || "network error"}` };
    } finally {
      clearTimeout(timeout);
    }

    const $ = cheerio.load(html);
    const title = $("title").first().text().trim();
    const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
    const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
    const h1s = $("h1")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);

    const jsonLd: unknown[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).html();
      if (!raw) return;
      try {
        jsonLd.push(JSON.parse(raw));
      } catch {
        // كتلة JSON-LD تالفة — تُتجاهل بدلاً من إفشال الجلب كله
      }
    });

    const imgs = $("img");
    const imgCount = imgs.length;
    const imgsMissingAlt = imgs.filter((_, el) => {
      const alt = $(el).attr("alt");
      return alt === undefined || alt.trim() === "";
    }).length;

    let internal = 0;
    let external = 0;
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) return;
      try {
        const link = new URL(href, fetchedUrl);
        if (link.origin === siteOrigin) internal++;
        else external++;
      } catch {
        // href تالف — لا يُحسب
      }
    });

    return {
      success: true,
      data: {
        fetchedUrl,
        fetchedAt: new Date().toISOString(),
        title,
        metaDescription,
        canonical,
        h1s,
        jsonLd,
        imgCount,
        imgsMissingAlt,
        links: { internal, external },
      },
    };
  }

  /**
   * Fix discovered SEO issues — يُصلح ويحفظ مسودة schema في qayyim_drafts
   */
  async fixSEOIssues(params: {
    analysisId?: string;
    url: string;
    issueCodes?: string[];
    autoFixAll?: boolean;
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `seo_fix_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const task: QayyimTask = {
      id: taskId,
      type: "seo_fix",
      title: `إصلاح مشاكل SEO لـ ${params.url}`,
      description: params.autoFixAll
        ? `أصلح كل المشاكل المكتشفة تلقائياً`
        : `أصلح المشاكل: ${params.issueCodes?.join(", ") || "الحرجة فقط"}`,
      context: { ...params.context, ...params, action: "fix" },
      priority: "critical",
    };

    const aiResult = await this.process(task);

    // حفظ الإصلاحات كمسودة في qayyim_drafts
    if (aiResult.success) {
      const schema = aiResult.data?.schema;
      const fixes  = aiResult.data?.issues ?? aiResult.suggestions ?? [];

      await createQayyimDraft({
        targetTable: "site_sections",
        targetId:    "seo_fixes",
        targetPath:  params.url,
        proposed: {
          seo_fixes:  fixes,
          schema_jsonld: schema ?? null,
          url:        params.url,
          agent:      this.agentKey,
          auto_fix:   params.autoFixAll ?? false,
        },
        draftType: "seo_fix",
        createdBy: this.agentKey,
        companyId: params.context?.company_id ?? this.companyId,
        metadata: {
          evidence_urls: aiResult.evidenceUrls ?? [],
          issues_count:  Array.isArray(fixes) ? fixes.length : 0,
        },
      });
    }

    return aiResult;
  }

  /**
   * Generate Schema.org — يحفظ JSON-LD في qayyim_drafts
   */
  async generateSchema(params: {
    pageType: 'Service' | 'Product' | 'Article' | 'FAQPage' | 'BreadcrumbList' | 'Organization' | 'LocalBusiness';
    pagePath: string;
    data: Record<string, any>;
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `schema_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const task: QayyimTask = {
      id: taskId,
      type: "schema_generate",
      title: `توليد Schema.org لـ ${params.pageType}`,
      description: `أنشئ JSON-LD schema من نوع ${params.pageType} لصفحة ${params.pagePath}`,
      context: { ...params.context, ...params, action: "generate_schema" },
      priority: "high",
    };

    const aiResult = await this.process(task);

    // احفظ الـ schema كمسودة
    if (aiResult.success) {
      const schemaData = aiResult.data?.schema ?? aiResult.output;
      await createQayyimDraft({
        targetTable: "site_sections",
        targetId:    `schema_${params.pageType.toLowerCase()}`,
        targetPath:  params.pagePath,
        proposed: {
          schema_type:  params.pageType,
          schema_jsonld: schemaData,
          page_path:    params.pagePath,
        },
        draftType: "schema_generate",
        createdBy: this.agentKey,
        companyId: params.context?.company_id ?? this.companyId,
      });
    }

    return aiResult;
  }

  /**
   * Content gap analysis vs competitors
   */
  async contentGapAnalysis(params: {
    ourUrls: string[];
    competitorUrls: string[];
    targetKeywords?: string[];
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `gap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "content_gap",
      title: "تحليل فجوات المحتوى",
      description: `حلل فجوات المحتوى بين ${params.ourUrls.length} صفحاتنا و ${params.competitorUrls.length} منافسين`,
      context: { ...params.context, ...params, action: "gap_analysis" },
      priority: "high",
    };

    return this.process(task);
  }

  /**
   * Keyword research for Arabic luxury interior
   */
  async keywordResearch(params: {
    seedTopics: string[]; // ['غرف نوم فاخرة', 'تصميم صالات', 'مطابخ مودرن']
    targetLocation?: string; // default 'Egypt'
    language?: 'ar' | 'en';
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `kw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "keyword_research",
      title: "بحث كلمات مفتاحية للعربي الفاخر",
      description: `ابحث عن كلمات مفتاحية لـ: ${params.seedTopics.join('، ')} في ${params.targetLocation || 'مصر'}`,
      context: { ...params.context, ...params, action: "keyword_research" },
      priority: "medium",
    };

    return this.process(task);
  }

  protected parseResult(taskId: string, response: string): QayyimResult {
    const base = super.parseResult(taskId, response);
    
    const issues = this.extractSEOIssues(response);
    const schema = this.extractSchema(response);
    const competitors = this.extractCompetitorInsights(response);

    return {
      ...base,
      data: {
        ...base.data,
        issues,
        schema,
        competitors,
        seoScore: this.extractScore(response),
        priority: this.extractPriority(response),
      }
    };
  }

  private extractSEOIssues(text: string): Array<{ 
    code: string; 
    title: string; 
    severity: 'critical' | 'high' | 'medium' | 'low';
    evidenceUrl: string;
    description: string;
    fix?: string;
  }> {
    const issues: Array<any> = [];
    
    // Pattern: "ISSUE-001: Missing H1 - critical - https://... - الوصف"
    const patterns = [
      /([A-Z]+-\d+)[:\s]*([^-\n]+)\s*-\s*(critical|high|medium|low)\s*[-–—]\s*(https?:\/\/[^\s\n]+)\s*[-–—]\s*([^\n]+)/gi,
      /(?:مشكلة|issue)[:\s]*([^-\n]+)\s*[-–—]\s*(critical|high|medium|low)\s*[-–—]\s*(https?:\/\/[^\s\n]+)\s*[-–—]\s*([^\n]+)/gi,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        issues.push({
          code: match[1]?.trim() || `SEO-${Date.now()}`,
          title: match[2]?.trim() || match[1]?.trim(),
          severity: match[3]?.trim() as 'critical' | 'high' | 'medium' | 'low',
          evidenceUrl: match[4]?.trim(),
          description: match[5]?.trim(),
        });
      }
    }
    return issues;
  }

  private extractSchema(text: string): any {
    // Look for JSON-LD in code blocks
    const jsonLdPattern = /```(?:json|jsonld|ld\+json)\n([\s\S]*?)```/gi;
    const match = jsonLdPattern.exec(text);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        return null;
      }
    }
    return null;
  }

  private extractCompetitorInsights(text: string): Array<{ competitor: string; insight: string; opportunity: string }> {
    const insights: Array<any> = [];
    
    const pattern = /(?:منافس|competitor)[:\s]*([^-\n]+)\s*[-–—]\s*([^-\n]+)\s*[-–—]\s*([^\n]+)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      insights.push({
        competitor: match[1].trim(),
        insight: match[2].trim(),
        opportunity: match[3].trim(),
      });
    }
    return insights;
  }

  private extractScore(text: string): number | null {
    const patterns = [
      /(?:score|درجة|نتيجة)[:\s]*(\d+(?:\.\d+)?)\s*\/?\s*100/gi,
      /(\d+(?:\.\d+)?)\s*\/\s*100/gi,
    ];
    
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) {
        const score = parseFloat(match[1]);
        if (!isNaN(score) && score <= 100) return score;
      }
    }
    return null;
  }

  private extractPriority(text: string): 'critical' | 'high' | 'medium' | 'low' {
    const lower = text.toLowerCase();
    if (lower.includes("critical") || lower.includes("حرج")) return 'critical';
    if (lower.includes("high") || lower.includes("عالي")) return 'high';
    if (lower.includes("medium") || lower.includes("متوسط")) return 'medium';
    return 'low';
  }
}

export const qayyimSeoAgent = new QayyimSeoAgent();