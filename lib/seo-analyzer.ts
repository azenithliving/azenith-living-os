/**
 * Real SEO Analyzer
 * 
 * Performs actual SEO analysis on web pages:
 * - Fetches real HTML content
 * - Analyzes meta tags, headings, images, links
 * - Calculates scores based on actual findings
 * - Generates real recommendations
 * - Saves results to database
 */

import * as cheerio from "cheerio";
import { createClient } from "./supabase-server";
import { logAuditEvent } from "./ultimate-agent/security-manager";
import type {
  SEOAnalysis,
  MetaTagsAnalysis,
  HeadingsAnalysis,
  ImagesAnalysis,
  LinksAnalysis,
  PerformanceMetrics,
  SEOIssue,
  SEORecommendation,
  ImageInfo,
  LinkInfo,
  HeadingNode,
  SEOAnalysisResultInsert,
  ToolExecutionContext,
  ExecutionResult,
} from "./agent-types";
import type { Json } from "./supabase/database.types";

// ============================================
// Configuration
// ============================================

const OPTIMAL_TITLE_LENGTH = { min: 30, max: 60 };
const OPTIMAL_DESCRIPTION_LENGTH = { min: 120, max: 160 };
const MAX_IMAGE_SIZE_BYTES = 1024 * 1024; // 1MB
const MODERN_IMAGE_FORMATS = ["webp", "avif"];

// SEO scoring weights
const SCORE_WEIGHTS = {
  meta: 20,
  headings: 15,
  images: 15,
  links: 15,
  performance: 20,
  mobile: 15,
};

// ============================================
// Main Analysis Function
// ============================================

export async function analyzeSEO(
  url: string,
  context?: ToolExecutionContext,
  options: { saveToDatabase?: boolean; fetchTimeout?: number } = {}
): Promise<ExecutionResult<SEOAnalysis>> {
  const startTime = Date.now();
  const executionId = context?.executionId || crypto.randomUUID();

  try {
    // Validate URL
    const validatedUrl = validateUrl(url);
    if (!validatedUrl) {
      return {
        success: false,
        executionId,
        message: "Invalid URL provided",
        error: "URL must be a valid HTTP/HTTPS URL",
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Fetch page content
    const fetchResult = await fetchPageContent(validatedUrl, options.fetchTimeout || 30000);
    if (!fetchResult.success) {
      return {
        success: false,
        executionId,
        message: `Failed to fetch page: ${fetchResult.error}`,
        error: fetchResult.error,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const { html, finalUrl, loadTimeMs, pageSize } = fetchResult;
    const $ = cheerio.load(html || "");
    const resolvedUrl = finalUrl || url;
    const resolvedLoadTime = loadTimeMs || 0;
    const resolvedPageSize = pageSize || 0;

    // Perform analyses
    const metaAnalysis = analyzeMetaTags($, resolvedUrl);
    const headingsAnalysis = analyzeHeadings($);
    const imagesAnalysis = analyzeImages($, resolvedUrl);
    const linksAnalysis = analyzeLinks($, resolvedUrl);
    const performanceMetrics = analyzePerformance(resolvedLoadTime, resolvedPageSize, $, resolvedUrl);

    // Calculate overall score
    const scoreBreakdown = calculateScoreBreakdown(
      metaAnalysis,
      headingsAnalysis,
      imagesAnalysis,
      linksAnalysis,
      performanceMetrics
    );

    const overallScore = Math.round(
      Object.values(scoreBreakdown).reduce((a, b) => a + b, 0)
    );

    // Generate issues and recommendations
    const issues = generateIssues(
      metaAnalysis,
      headingsAnalysis,
      imagesAnalysis,
      linksAnalysis,
      performanceMetrics
    );

    const recommendations = generateRecommendations(issues, scoreBreakdown);

    // Build final result
    const result: SEOAnalysis = {
      pageUrl: finalUrl || url,
      pageTitle: metaAnalysis.title.value || undefined,
      score: overallScore,
      scoreBreakdown,
      metaTags: metaAnalysis,
      headings: headingsAnalysis,
      images: imagesAnalysis,
      links: linksAnalysis,
      performance: performanceMetrics,
      issues,
      recommendations,
    };

    // Save to database if requested
    if (options.saveToDatabase !== false && context) {
      await saveSEOAnalysisToDatabase(result, context);
    }

    const executionTimeMs = Date.now() - startTime;

    // Log success
    await logAuditEvent(
      "seo_analysis",
      `Analyzed ${finalUrl || url} - Score: ${overallScore}`,
      context?.actorUserId || "system",
      { url: finalUrl || url, score: overallScore, issuesFound: issues.length },
      "success",
      { companyId: context?.companyId, actorUserId: context?.actorUserId, commandLogId: context?.commandLogId }
    );

    return {
      success: true,
      executionId,
      message: `SEO analysis completed for ${finalUrl} - Score: ${overallScore}/100`,
      data: result,
      executionTimeMs,
      affectedTables: ["seo_analysis_results", "agent_executions"],
      affectedRows: 1,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    const executionTimeMs = Date.now() - startTime;

    await logAuditEvent(
      "seo_analysis",
      `Failed to analyze ${url}`,
      context?.actorUserId || "system",
      { url, error: errorMsg },
      "failure",
      { companyId: context?.companyId, actorUserId: context?.actorUserId, commandLogId: context?.commandLogId }
    );

    return {
      success: false,
      executionId,
      message: `SEO analysis failed: ${errorMsg}`,
      error: errorMsg,
      executionTimeMs,
    };
  }
}

// ============================================
// URL Validation
// ============================================

function validateUrl(url: string): string | null {
  try {
    // Add protocol if missing
    let urlToCheck = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      urlToCheck = `https://${url}`;
    }

    const parsed = new URL(urlToCheck);
    
    // Validate protocol
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    // Validate hostname
    if (!parsed.hostname || parsed.hostname.includes("..")) {
      return null;
    }

    // Block internal/admin URLs for security
    const blockedPaths = ["/admin", "/api", "/_next", "/.env", "/config"];
    if (blockedPaths.some((path) => parsed.pathname.startsWith(path))) {
      return null;
    }

    return urlToCheck;
  } catch {
    return null;
  }
}

// ============================================
// Page Fetching
// ============================================

interface FetchResult {
  success: boolean;
  html?: string;
  finalUrl?: string;
  loadTimeMs?: number;
  pageSize?: number;
  error?: string;
}

async function fetchPageContent(url: string, timeout: number): Promise<FetchResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    const loadTimeMs = Date.now() - startTime;
    const pageSize = Buffer.byteLength(html, "utf8");

    return {
      success: true,
      html,
      finalUrl: response.url,
      loadTimeMs,
      pageSize,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "Request timed out" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch page",
    };
  }
}

// ============================================
// Meta Tags Analysis
// ============================================

function analyzeMetaTags($: cheerio.CheerioAPI, url: string): MetaTagsAnalysis {
  const result: MetaTagsAnalysis = {
    title: analyzeTitle($),
    description: analyzeDescription($),
    canonical: analyzeCanonical($, url),
    viewport: analyzeViewport($),
  };

  // Open Graph tags
  const ogTitle = $('meta[property="og:title"]').attr("content");
  if (ogTitle) {
    result.ogTitle = {
      value: ogTitle,
      length: ogTitle.length,
      optimal: OPTIMAL_TITLE_LENGTH,
      isOptimal: isWithinRange(ogTitle.length, OPTIMAL_TITLE_LENGTH),
      score: calculateTextScore(ogTitle.length, OPTIMAL_TITLE_LENGTH),
    };
  }

  const ogDescription = $('meta[property="og:description"]').attr("content");
  if (ogDescription) {
    result.ogDescription = {
      value: ogDescription,
      length: ogDescription.length,
      optimal: OPTIMAL_DESCRIPTION_LENGTH,
      isOptimal: isWithinRange(ogDescription.length, OPTIMAL_DESCRIPTION_LENGTH),
      score: calculateTextScore(ogDescription.length, OPTIMAL_DESCRIPTION_LENGTH),
    };
  }

  return result;
}

function analyzeTitle($: cheerio.CheerioAPI) {
  const title = $("title").text().trim();
  return {
    value: title,
    length: title.length,
    optimal: OPTIMAL_TITLE_LENGTH,
    isOptimal: isWithinRange(title.length, OPTIMAL_TITLE_LENGTH),
    score: calculateTextScore(title.length, OPTIMAL_TITLE_LENGTH, 10),
  };
}

function analyzeDescription($: cheerio.CheerioAPI) {
  const description = $('meta[name="description"]').attr("content") || "";
  return {
    value: description,
    length: description.length,
    optimal: OPTIMAL_DESCRIPTION_LENGTH,
    isOptimal: isWithinRange(description.length, OPTIMAL_DESCRIPTION_LENGTH),
    score: calculateTextScore(description.length, OPTIMAL_DESCRIPTION_LENGTH, 10),
  };
}

function analyzeCanonical($: cheerio.CheerioAPI, url: string) {
  const canonical = $('link[rel="canonical"]').attr("href");
  return {
    value: canonical || "",
    valid: canonical ? isValidCanonical(canonical, url) : false,
  };
}

function analyzeViewport($: cheerio.CheerioAPI) {
  const viewport = $('meta[name="viewport"]').attr("content") || "";
  return {
    value: viewport,
    mobileOptimized: viewport.includes("width=device-width"),
  };
}

function isValidCanonical(canonical: string, pageUrl: string): boolean {
  try {
    const canonicalUrl = new URL(canonical, pageUrl).href;
    const currentUrl = new URL(pageUrl).href;
    return canonicalUrl === currentUrl;
  } catch {
    return false;
  }
}

// ============================================
// Headings Analysis
// ============================================

function analyzeHeadings($: cheerio.CheerioAPI): HeadingsAnalysis {
  const headings: HeadingsAnalysis = {
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    hierarchyValid: true,
    multipleH1: false,
    missingH1: false,
  };

  // Extract all headings
  for (let i = 1; i <= 6; i++) {
    const tag = `h${i}`;
    $(tag).each((_, el) => {
      const node: HeadingNode = {
        level: i,
        text: $(el).text().trim(),
        id: $(el).attr("id") || undefined,
      };
      const headingArray = headings[tag as keyof HeadingsAnalysis];
      if (Array.isArray(headingArray)) {
        headingArray.push(node);
      }
    });
  }

  // Validate hierarchy
  headings.multipleH1 = headings.h1.length > 1;
  headings.missingH1 = headings.h1.length === 0;

  // Check for skipped levels (e.g., h1 -> h3 without h2)
  let prevLevel = 1;
  for (let i = 2; i <= 6; i++) {
    const currentLevelHeadings = headings[`h${i}` as keyof HeadingsAnalysis] as HeadingNode[];
    if (currentLevelHeadings.length > 0) {
      if (i > prevLevel + 1) {
        headings.hierarchyValid = false;
      }
      prevLevel = i;
    }
  }

  return headings;
}

// ============================================
// Images Analysis
// ============================================

function analyzeImages($: cheerio.CheerioAPI, baseUrl: string): ImagesAnalysis {
  const images: ImageInfo[] = [];
  let withoutAlt = 0;
  let oversized = 0;
  let modernFormat = 0;
  let lazyLoaded = 0;

  $("img").each((_, el) => {
    const src = $(el).attr("src");
    const alt = $(el).attr("alt") || "";
    const loading = $(el).attr("loading");

    if (!src) return;

    const fullSrc = resolveUrl(src, baseUrl);
    const format = getImageFormat(fullSrc);
    const isModern = MODERN_IMAGE_FORMATS.includes(format.toLowerCase());
    const hasAlt = alt.length > 0 && !alt.match(/^\d+$/); // Not just a number

    const imageInfo: ImageInfo = {
      src: fullSrc,
      alt,
      hasAlt,
      isModernFormat: isModern,
      isLazyLoaded: loading === "lazy",
      format,
    };

    images.push(imageInfo);

    if (!hasAlt) withoutAlt++;
    if (isModern) modernFormat++;
    if (loading === "lazy") lazyLoaded++;

    // Note: Actual file size would require fetching the image
    // For now we estimate based on dimensions if available
    const width = parseInt($(el).attr("width") || "0", 10);
    const height = parseInt($(el).attr("height") || "0", 10);
    if (width > 2000 || height > 2000) {
      oversized++;
    }
  });

  return {
    total: images.length,
    withoutAlt,
    oversized,
    modernFormat,
    lazyLoaded,
    images,
  };
}

function resolveUrl(src: string, baseUrl: string): string {
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

function getImageFormat(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase() || "";
  const formatMap: Record<string, string> = {
    jpg: "jpeg",
    jpeg: "jpeg",
    png: "png",
    gif: "gif",
    svg: "svg",
    webp: "webp",
    avif: "avif",
  };
  return formatMap[ext] || "unknown";
}

// ============================================
// Links Analysis
// ============================================

function analyzeLinks($: cheerio.CheerioAPI, baseUrl: string): LinksAnalysis {
  const links: LinkInfo[] = [];
  let internal = 0;
  let external = 0;
  let nofollow = 0;

  const baseHostname = new URL(baseUrl).hostname;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

    const fullUrl = resolveUrl(href, baseUrl);
    let hostname: string;

    try {
      hostname = new URL(fullUrl).hostname;
    } catch {
      return;
    }

    const isExternal = hostname !== baseHostname;
    const rel = $(el).attr("rel") || "";
    const isNofollow = rel.includes("nofollow");

    const link: LinkInfo = {
      url: fullUrl,
      text: $(el).text().trim(),
      isExternal,
      isNofollow,
    };

    links.push(link);

    if (isExternal) external++;
    else internal++;
    if (isNofollow) nofollow++;
  });

  return {
    internal,
    external,
    nofollow,
    links,
  };
}

// ============================================
// Performance Analysis
// ============================================

function analyzePerformance(
  loadTimeMs: number,
  pageSize: number,
  $: cheerio.CheerioAPI,
  url: string
): PerformanceMetrics {
  const hasHttps = url.startsWith("https://");

  // Check for mobile viewport
  const viewport = $('meta[name="viewport"]').attr("content") || "";
  const mobileFriendly = viewport.includes("width=device-width");

  // Estimate performance score based on load time and page size
  // These are rough estimates without actual Lighthouse metrics
  let performanceScore = 100;

  // Deduct for slow load time
  if (loadTimeMs > 1000) performanceScore -= 10;
  if (loadTimeMs > 2500) performanceScore -= 15;
  if (loadTimeMs > 4000) performanceScore -= 20;

  // Deduct for large page size
  const sizeKb = pageSize / 1024;
  if (sizeKb > 1000) performanceScore -= 10;
  if (sizeKb > 2000) performanceScore -= 15;
  if (sizeKb > 3000) performanceScore -= 20;

  // Count resources
  const cssCount = $("link[rel='stylesheet']").length;
  const jsCount = $("script[src]").length;

  if (cssCount > 5) performanceScore -= 5;
  if (jsCount > 10) performanceScore -= 10;

  return {
    loadTimeMs,
    pageSizeKb: Math.round(sizeKb),
    requestsCount: cssCount + jsCount + $("img").length,
    mobileFriendly,
    hasHttps,
    // Estimated metrics
    serverResponseTime: Math.round(loadTimeMs * 0.3),
    firstContentfulPaint: Math.round(loadTimeMs * 0.5),
    largestContentfulPaint: loadTimeMs,
  };
}

// ============================================
// Scoring Functions
// ============================================

function calculateScoreBreakdown(
  meta: MetaTagsAnalysis,
  headings: HeadingsAnalysis,
  images: ImagesAnalysis,
  links: LinksAnalysis,
  performance: PerformanceMetrics
) {
  // Meta score (max 20)
  let metaScore = 0;
  metaScore += meta.title.score;
  metaScore += meta.description.score;
  if (meta.canonical?.valid) metaScore += 5;
  if (meta.viewport?.mobileOptimized) metaScore += 5;
  metaScore = Math.min(metaScore, SCORE_WEIGHTS.meta);

  // Headings score (max 15)
  let headingsScore = SCORE_WEIGHTS.headings;
  if (headings.missingH1) headingsScore -= 7;
  if (headings.multipleH1) headingsScore -= 5;
  if (!headings.hierarchyValid) headingsScore -= 3;
  headingsScore = Math.max(0, headingsScore);

  // Images score (max 15)
  let imagesScore = SCORE_WEIGHTS.images;
  if (images.total > 0) {
    const altRatio = 1 - images.withoutAlt / images.total;
    imagesScore = Math.round(SCORE_WEIGHTS.images * altRatio);
    // Bonus for modern formats
    imagesScore += Math.round((images.modernFormat / images.total) * 5);
  }
  imagesScore = Math.min(imagesScore, SCORE_WEIGHTS.images);

  // Links score (max 15)
  let linksScore = SCORE_WEIGHTS.links;
  const totalLinks = links.internal + links.external;
  if (totalLinks > 100) linksScore -= 5; // Too many links
  linksScore = Math.max(0, linksScore);

  // Performance score (max 20)
  let performanceScore = SCORE_WEIGHTS.performance;
  if (performance.loadTimeMs > 3000) performanceScore -= 10;
  if (performance.loadTimeMs > 5000) performanceScore -= 10;
  if (!performance.hasHttps) performanceScore -= 5;
  if (!performance.mobileFriendly) performanceScore -= 5;
  performanceScore = Math.max(0, performanceScore);

  // Mobile score (max 15)
  let mobileScore = SCORE_WEIGHTS.mobile;
  if (!performance.mobileFriendly) mobileScore -= 10;
  if (performance.loadTimeMs > 3000) mobileScore -= 5;
  mobileScore = Math.max(0, mobileScore);

  return {
    meta: metaScore,
    headings: headingsScore,
    images: imagesScore,
    links: linksScore,
    performance: performanceScore,
    mobile: mobileScore,
  };
}

function calculateTextScore(length: number, range: { min: number; max: number }, maxScore = 10): number {
  if (length === 0) return 0;
  if (length >= range.min && length <= range.max) return maxScore;
  if (length < range.min) return Math.round((length / range.min) * maxScore);
  return Math.round(Math.max(0, (1 - (length - range.max) / range.max) * maxScore));
}

function isWithinRange(value: number, range: { min: number; max: number }): boolean {
  return value >= range.min && value <= range.max;
}

// ============================================
// Issues Generation
// ============================================

function generateIssues(
  meta: MetaTagsAnalysis,
  headings: HeadingsAnalysis,
  images: ImagesAnalysis,
  links: LinksAnalysis,
  performance: PerformanceMetrics
): SEOIssue[] {
  const issues: SEOIssue[] = [];

  // Meta issues
  if (!meta.title.value) {
    issues.push({
      code: "missing_title",
      severity: "critical",
      category: "meta",
      message: "Page is missing a title tag",
      recommendation: "Add a descriptive title tag between 30-60 characters",
      autoFixable: false,
      estimatedImpact: 95,
    });
  } else if (!meta.title.isOptimal) {
    issues.push({
      code: "title_length_suboptimal",
      severity: meta.title.length < 30 ? "high" : "medium",
      category: "meta",
      message: `Title length is ${meta.title.length} characters (optimal: 30-60)`,
      element: meta.title.value,
      recommendation: "Adjust title length to be between 30-60 characters for optimal display in search results",
      autoFixable: false,
      estimatedImpact: 60,
    });
  }

  if (!meta.description.value) {
    issues.push({
      code: "missing_meta_description",
      severity: "high",
      category: "meta",
      message: "Page is missing a meta description",
      recommendation: "Add a compelling meta description between 120-160 characters",
      autoFixable: false,
      estimatedImpact: 80,
    });
  } else if (!meta.description.isOptimal) {
    issues.push({
      code: "meta_description_length_suboptimal",
      severity: "medium",
      category: "meta",
      message: `Meta description length is ${meta.description.length} characters (optimal: 120-160)`,
      recommendation: "Adjust description length for optimal display in search results",
      autoFixable: false,
      estimatedImpact: 40,
    });
  }

  if (!meta.canonical?.valid) {
    issues.push({
      code: "invalid_canonical",
      severity: "medium",
      category: "meta",
      message: "Canonical URL is missing or invalid",
      recommendation: "Add a valid canonical URL to prevent duplicate content issues",
      autoFixable: true,
      estimatedImpact: 50,
    });
  }

  // Headings issues
  if (headings.missingH1) {
    issues.push({
      code: "missing_h1",
      severity: "high",
      category: "headings",
      message: "Page has no H1 heading",
      recommendation: "Add a single H1 heading that describes the main topic of the page",
      autoFixable: false,
      estimatedImpact: 70,
    });
  }

  if (headings.multipleH1) {
    issues.push({
      code: "multiple_h1",
      severity: "medium",
      category: "headings",
      message: `Page has ${headings.h1.length} H1 headings (should have only 1)`,
      recommendation: "Consolidate multiple H1 headings into a single main heading",
      autoFixable: false,
      estimatedImpact: 45,
    });
  }

  if (!headings.hierarchyValid) {
    issues.push({
      code: "invalid_heading_hierarchy",
      severity: "medium",
      category: "headings",
      message: "Heading hierarchy is invalid (skipped levels detected)",
      recommendation: "Ensure headings follow proper hierarchy (H1 > H2 > H3, without skipping levels)",
      autoFixable: false,
      estimatedImpact: 35,
    });
  }

  // Images issues
  if (images.withoutAlt > 0) {
    issues.push({
      code: "images_missing_alt",
      severity: images.withoutAlt / images.total > 0.5 ? "high" : "medium",
      category: "images",
      message: `${images.withoutAlt} of ${images.total} images are missing alt text`,
      recommendation: "Add descriptive alt text to all images for accessibility and SEO",
      autoFixable: false,
      estimatedImpact: 55,
    });
  }

  if (images.oversized > 0) {
    issues.push({
      code: "oversized_images",
      severity: "medium",
      category: "images",
      message: `${images.oversized} images appear to be oversized`,
      recommendation: "Compress and resize large images to improve page load speed",
      autoFixable: true,
      estimatedImpact: 40,
    });
  }

  // Performance issues
  if (performance.loadTimeMs > 3000) {
    issues.push({
      code: "slow_page_load",
      severity: performance.loadTimeMs > 5000 ? "high" : "medium",
      category: "performance",
      message: `Page load time is ${(performance.loadTimeMs / 1000).toFixed(2)}s (target: < 3s)`,
      recommendation: "Optimize images, minify CSS/JS, and consider using a CDN to improve load time",
      autoFixable: true,
      estimatedImpact: 65,
    });
  }

  if (!performance.hasHttps) {
    issues.push({
      code: "no_https",
      severity: "high",
      category: "performance",
      message: "Page is not served over HTTPS",
      recommendation: "Enable HTTPS to improve security and search rankings",
      autoFixable: false,
      estimatedImpact: 85,
    });
  }

  if (!performance.mobileFriendly) {
    issues.push({
      code: "not_mobile_friendly",
      severity: "high",
      category: "mobile",
      message: "Page viewport is not configured for mobile devices",
      recommendation: "Add viewport meta tag: <meta name='viewport' content='width=device-width, initial-scale=1'>",
      autoFixable: true,
      estimatedImpact: 75,
    });
  }

  return issues.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

// ============================================
// Recommendations Generation
// ============================================

function generateRecommendations(issues: SEOIssue[], scoreBreakdown: Record<string, number>): SEORecommendation[] {
  const recommendations: SEORecommendation[] = [];

  // Add recommendations based on issues
  for (const issue of issues.filter((i) => i.severity !== "low")) {
    recommendations.push({
      priority: issue.severity as "critical" | "high" | "medium",
      category: issue.category,
      title: issue.code
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      description: issue.message,
      expectedImpact: `Estimated impact: ${issue.estimatedImpact}/100 on SEO score`,
      autoFixable: issue.autoFixable,
      estimatedTime: issue.autoFixable ? "5-15 minutes" : "30-60 minutes",
      steps: [issue.recommendation],
    });
  }

  // Add score-based recommendations
  if (scoreBreakdown.meta < 15) {
    recommendations.push({
      priority: "high",
      category: "meta",
      title: "Optimize Meta Tags",
      description: "Improve title and meta description to increase click-through rates",
      expectedImpact: "Significant improvement in search visibility",
      autoFixable: false,
      estimatedTime: "20-30 minutes",
      steps: [
        "Review and update page title to be descriptive and compelling",
        "Write a unique meta description that summarizes page content",
        "Ensure title is 30-60 characters and description is 120-160 characters",
      ],
    });
  }

  if (scoreBreakdown.images < 10) {
    recommendations.push({
      priority: "medium",
      category: "images",
      title: "Image Optimization",
      description: "Convert images to modern formats and add alt text",
      expectedImpact: "Better accessibility and faster load times",
      autoFixable: true,
      estimatedTime: "15-30 minutes",
      steps: [
        "Add descriptive alt text to all images",
        "Convert large images to WebP format",
        "Implement lazy loading for below-the-fold images",
        "Compress images to reduce file size",
      ],
    });
  }

  if (scoreBreakdown.performance < 15) {
    recommendations.push({
      priority: "high",
      category: "performance",
      title: "Performance Optimization",
      description: "Improve page load speed for better user experience and rankings",
      expectedImpact: "Lower bounce rate and better search rankings",
      autoFixable: true,
      estimatedTime: "1-2 hours",
      steps: [
        "Optimize and compress images",
        "Minify CSS and JavaScript files",
        "Enable browser caching",
        "Consider using a CDN for static assets",
      ],
    });
  }

  return recommendations.slice(0, 10); // Limit to top 10 recommendations
}

// ============================================
// Database Persistence
// ============================================

async function saveSEOAnalysisToDatabase(
  analysis: SEOAnalysis,
  context: ToolExecutionContext
): Promise<void> {
  const supabase = await createClient();

  const resultData: SEOAnalysisResultInsert = {
    execution_id: context.executionId,
    company_id: context.companyId || null,
    page_url: analysis.pageUrl,
    page_title: analysis.pageTitle || null,
    score: analysis.score,
    score_breakdown: analysis.scoreBreakdown,
    meta_tags: analysis.metaTags as unknown as Json,
    meta_issues: analysis.issues.filter((i) => i.category === "meta") as unknown as Json[],
    headings_structure: analysis.headings as unknown as Json,
    headings_issues: analysis.issues.filter((i) => i.category === "headings") as unknown as Json[],
    images_analysis: analysis.images as unknown as Json,
    images_issues: analysis.issues.filter((i) => i.category === "images") as unknown as Json[],
    links_analysis: analysis.links as unknown as Json,
    links_issues: analysis.issues.filter((i) => i.category === "links") as unknown as Json[],
    performance_metrics: analysis.performance as unknown as Json,
    performance_issues: analysis.issues.filter((i) => i.category === "performance" || i.category === "mobile") as unknown as Json[],
    recommendations: analysis.recommendations as unknown as Json[],
    analysis_status: "completed",
  };

  const { error } = await supabase.from("seo_analysis_results").insert(resultData);

  if (error) {
    console.error("[SEOAnalyzer] Failed to save analysis to database:", error);
    throw error;
  }

  // Update execution status
  await supabase
    .from("agent_executions")
    .update({
      execution_status: "completed",
      execution_result: resultData,
      completed_at: new Date().toISOString(),
      execution_time_ms: Date.now() - new Date().getTime(),
    })
    .eq("id", context.executionId);
}

// ============================================
// Utility Functions
// ============================================

export async function getRecentSEOAnalyses(
  limit: number = 10,
  companyId?: string
): Promise<SEOAnalysis[]> {
  const supabase = await createClient();

  let query = supabase
    .from("seo_analysis_results")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[SEOAnalyzer] Failed to fetch recent analyses:", error);
    return [];
  }

  return (data || []).map((row) => ({
    pageUrl: row.page_url,
    pageTitle: row.page_title || undefined,
    score: row.score || 0,
    scoreBreakdown: (row.score_breakdown as { meta: number; headings: number; images: number; links: number; performance: number; mobile: number }) || {
      meta: 0,
      headings: 0,
      images: 0,
      links: 0,
      performance: 0,
      mobile: 0,
    },
    metaTags: (row.meta_tags as MetaTagsAnalysis) || { title: { value: "", length: 0, optimal: { min: 30, max: 60 }, isOptimal: false, score: 0 }, description: { value: "", length: 0, optimal: { min: 120, max: 160 }, isOptimal: false, score: 0 }, canonical: { value: "", valid: false }, viewport: { value: "", mobileOptimized: false } },
    headings: (row.headings_structure as HeadingsAnalysis) || { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [], hierarchyValid: true, multipleH1: false, missingH1: false },
    images: (row.images_analysis as ImagesAnalysis) || { total: 0, withoutAlt: 0, oversized: 0, modernFormat: 0, lazyLoaded: 0, images: [] },
    links: (row.links_analysis as LinksAnalysis) || { internal: 0, external: 0, nofollow: 0, links: [] },
    performance: (row.performance_metrics as PerformanceMetrics) || { loadTimeMs: 0, pageSizeKb: 0, requestsCount: 0, mobileFriendly: false, hasHttps: false },
    issues: (row.recommendations as SEOIssue[]) || [],
    recommendations: (row.recommendations as SEORecommendation[]) || [],
  }));
}

export async function getSEOAnalysisById(id: string): Promise<SEOAnalysis | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("seo_analysis_results")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    pageUrl: data.page_url,
    pageTitle: data.page_title || undefined,
    score: data.score || 0,
    scoreBreakdown: data.score_breakdown as { meta: number; headings: number; images: number; links: number; performance: number; mobile: number },
    metaTags: data.meta_tags as MetaTagsAnalysis,
    headings: data.headings_structure as HeadingsAnalysis,
    images: data.images_analysis as ImagesAnalysis,
    links: data.links_analysis as LinksAnalysis,
    performance: data.performance_metrics as PerformanceMetrics,
    issues: (data.recommendations as SEOIssue[]) || [],
    recommendations: (data.recommendations as SEORecommendation[]) || [],
  };
}
