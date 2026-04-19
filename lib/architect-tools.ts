/**
 * Architect Tools - FIXED COMPLETE VERSION
 * Original tools preserved + NEW tools + TOOL_DEFINITIONS + executeTool
 * Fixes Vercel build + all imports
 */

import { supabaseService } from "./supabase-service";
import { getSupabaseServerClient } from "./supabase";
import { resolvePrimaryCompanyId } from "./company-resolver";
import { load as loadHtml } from "cheerio";

// Types
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  message: string;
}

export interface AutomationRuleInput {
  name: string;
  trigger: "page_visit" | "form_submit" | "booking_status_changed" | "lead_updated" | "time_delay" | "user_registered";
  conditions: Record<string, unknown>;
  actions: Array<{ type: string; message?: string; intent?: string }>;
  enabled?: boolean;
}

export interface SiteSettingInput {
  key: "theme" | "seo" | "general";
  value: Record<string, unknown>;
}

export interface AnalyticsPeriod {
  days: 7 | 30 | 90;
}

export interface CreateSectionInput {
  name: string;
  description?: string;
  imageIds?: string[];
}

export interface ProductInput {
  name: string;
  description?: string;
  price: number;
  imageIds?: string[];
  category?: string;
}

export interface WebSearchInput {
  query: string;
}

export interface ReadWebsiteInput {
  url: string;
}

export interface SeoAuditInput {
  url?: string;
  maxPages?: number;
}

export interface ContentHealthInput {
  url?: string;
  maxPages?: number;
}

export interface RevenueAnalysisInput {
  days?: 7 | 30 | 90;
}

export interface SpeedAuditInput {
  url?: string;
  strategy?: "mobile" | "desktop";
}

interface ThemeValue {
  primaryColor?: string;
}

interface SeoValue {
  siteTitle?: string;
}

const STRICT_MODE = process.env.AGENT_STRICT_MODE
  ? process.env.AGENT_STRICT_MODE === "true"
  : process.env.NODE_ENV === "production";

const DEFAULT_FETCH_TIMEOUT_MS = 12_000;

function resolveSiteUrl(provided?: string): string | null {
  const raw =
    provided ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const candidate = (raw || "").trim();
  if (!candidate) return null;

  try {
    const withProtocol = candidate.startsWith("http") ? candidate : `https://${candidate}`;
    return new URL(withProtocol).toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function safeJoinUrl(baseUrl: string, path: string) {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return "";
  }
}

async function fetchText(url: string, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS): Promise<{
  success: boolean;
  status?: number;
  text?: string;
  error?: string;
}> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "AzenithUltimateAgent/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    const text = await res.text();
    if (!res.ok) {
      return { success: false, status: res.status, error: `HTTP ${res.status}`, text };
    }

    return { success: true, status: res.status, text };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function collectInternalLinks(html: string, baseUrl: string, limit: number) {
  const $ = loadHtml(html);
  const base = new URL(baseUrl);
  const out: string[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    if (out.length >= limit) return;
    const href = ($(el).attr("href") || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

    const absolute = safeJoinUrl(baseUrl, href);
    if (!absolute) return;

    try {
      const u = new URL(absolute);
      if (u.origin !== base.origin) return;
      u.hash = "";
      // Reduce obvious duplicates (e.g., trailing slash)
      const normalized = u.toString().replace(/\/+$/, "");
      if (seen.has(normalized)) return;
      seen.add(normalized);
      out.push(normalized);
    } catch {
      return;
    }
  });

  return out;
}

function wordCountFromHtml(html: string) {
  const $ = loadHtml(html);
  $("script,style,noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

// ORIGINAL TOOLS
export async function createAutomationRule(input: AutomationRuleInput): Promise<ToolResult> {
  try {
    if (!input.name || !input.trigger) {
      return { success: false, error: "Missing name/trigger", message: "فشل: اسم ومشغل مطلوب" };
    }

    const enabled = input.enabled !== false;
    const companyId = await resolvePrimaryCompanyId().catch(() => null);

    // Try newest schema first (tenant scoped + enabled/is_active flags).
    const primaryInsert = await supabaseService
      .from("automation_rules")
      .insert({
        name: input.name,
        trigger: input.trigger,
        conditions: input.conditions || {},
        actions: input.actions || [],
        enabled,
        is_active: enabled,
        ...(companyId ? { company_id: companyId } : {}),
      })
      .select()
      .single();

    if (!primaryInsert.error && primaryInsert.data) {
      const row = primaryInsert.data as { id?: string };
      return {
        success: true,
        data: primaryInsert.data,
        message: `✅ "${input.name}" جاهز (ID: ${(row.id || "").slice(0, 8)})`,
      };
    }

    // Fallback: legacy schema (no company_id / no is_active)
    const legacyInsert = await supabaseService
      .from("automation_rules")
      .insert({
        name: input.name,
        trigger: input.trigger,
        conditions: input.conditions || {},
        actions: input.actions || [],
        enabled,
      })
      .select()
      .single();

    if (!legacyInsert.error && legacyInsert.data) {
      const row = legacyInsert.data as { id?: string };
      return {
        success: true,
        data: legacyInsert.data,
        message: `✅ "${input.name}" جاهز (ID: ${(row.id || "").slice(0, 8)})`,
      };
    }

    const primaryErrorMsg = primaryInsert.error?.message || "";
    const legacyErrorMsg = legacyInsert.error?.message || "";
    console.error("[createAutomationRule] primary failed:", primaryErrorMsg);
    console.error("[createAutomationRule] legacy failed:", legacyErrorMsg);

    return {
      success: false,
      error: legacyErrorMsg || primaryErrorMsg,
      message: `فشل إنشاء قاعدة الأتمتة "${input.name}"`,
    };
  } catch (err) {
    const errorMsg = String(err);
    return { success: false, error: errorMsg, message: "❌ خطأ غير متوقع" };
  }
}

export async function updateSiteSetting(input: SiteSettingInput): Promise<ToolResult> {
  try {
    const { key, value } = input;

    if (!key || !value) {
      return { success: false, error: "key/value required", message: "فشل: مفتاح وقيمة مطلوبة" };
    }

    const companyId = await resolvePrimaryCompanyId().catch(() => null);

    // Load existing value to merge (prevents wiping other keys).
    let existingValue: unknown = undefined;
    try {
      if (companyId) {
        const scoped = await supabaseService
          .from("site_settings")
          .select("value")
          .eq("company_id", companyId)
          .eq("key", key)
          .maybeSingle();

        if (!scoped.error && scoped.data) {
          existingValue = (scoped.data as { value?: unknown }).value;
        } else if (scoped.error?.message?.includes("company_id")) {
          const legacy = await supabaseService
            .from("site_settings")
            .select("value")
            .eq("key", key)
            .maybeSingle();
          if (!legacy.error && legacy.data) existingValue = (legacy.data as { value?: unknown }).value;
        }
      } else {
        const legacy = await supabaseService
          .from("site_settings")
          .select("value")
          .eq("key", key)
          .maybeSingle();
        if (!legacy.error && legacy.data) existingValue = (legacy.data as { value?: unknown }).value;
      }
    } catch {}

    const canMerge =
      existingValue &&
      typeof existingValue === "object" &&
      !Array.isArray(existingValue) &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value);

    const mergedValue = canMerge
      ? { ...(existingValue as Record<string, unknown>), ...(value as Record<string, unknown>) }
      : value;

    const basePayload: Record<string, unknown> = {
      key,
      value: mergedValue,
      updated_at: new Date().toISOString(),
    };

    const tenantPayload = companyId ? { ...basePayload, company_id: companyId } : basePayload;
    const primaryOnConflict = companyId ? "company_id,key" : "key";

    let result = await supabaseService
      .from("site_settings")
      .upsert(tenantPayload, { onConflict: primaryOnConflict })
      .select()
      .single();

    if (result.error && companyId) {
      const msg = result.error.message || "";
      const fallbackAllowed =
        msg.includes("company_id") ||
        result.error.code === "42P10" ||
        msg.toLowerCase().includes("constraint");

      if (fallbackAllowed) {
        result = await supabaseService
          .from("site_settings")
          .upsert(basePayload, { onConflict: "key" })
          .select()
          .single();
      }
    }

    if (result.error) {
      const code = result.error.code;
      const msg = result.error.message || "unknown error";
      const isMissingTable = code === "42P01" || msg.toLowerCase().includes("does not exist");

      if (isMissingTable) {
        if (!STRICT_MODE) {
          return { success: true, data: { key, value: mergedValue, simulated: true }, message: `⚠️ "${key}" محفوظ (محاكاة - جدول غير موجود)` };
        }
        return { success: false, error: msg, message: "فشل: جدول site_settings غير موجود." };
      }

      console.error("[updateSiteSetting]", result.error);
      return { success: false, error: msg, message: `فشل تحديث "${key}": ${msg}` };
    }

    const themeValue = mergedValue as ThemeValue;
    const seoValue = mergedValue as SeoValue;
    let changeDesc = "تم تحديث الإعداد";
    if (key === "theme" && themeValue.primaryColor) changeDesc = `اللون: ${themeValue.primaryColor}`;
    else if (key === "seo" && seoValue.siteTitle) changeDesc = `العنوان: ${seoValue.siteTitle}`;

    return { success: true, data: result.data, message: `✅ "${key}" محدث (${changeDesc})` };
  } catch (err) {
    const errorMsg = String(err);
    return { success: false, error: errorMsg, message: "❌ خطأ تحديث إعداد" };
  }
}

export async function getAnalyticsReport(period: AnalyticsPeriod = { days: 30 }): Promise<ToolResult> {
  try {
    const supabase = getSupabaseServerClient();
    const days = period.days || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [usersResult, requestsResult, eventsResult] = await Promise.all([
      supabase.from("users").select("id, created_at, room_type, style, score", { count: "exact" }).gte("created_at", startDate),
      supabase.from("requests").select("id, status, created_at", { count: "exact" }).gte("created_at", startDate),
      supabase.from("events").select("type").eq("type", "whatsapp_click").gte("created_at", startDate)
    ]);

    const totalLeads = usersResult.data?.length || 0;
    const totalRequests = requestsResult.data?.length || 0;
    const acceptedBookings =
      requestsResult.data?.filter((r: { status?: string }) => r.status === "accepted").length || 0;
    const whatsappClicks = eventsResult.data?.length || 0;
    const conversionRate = totalLeads > 0 ? ((acceptedBookings / totalLeads) * 100).toFixed(1) : "0";

    const report = {
      period: `${days} يوم`,
      totalLeads,
      totalRequests,
      acceptedBookings,
      whatsappClicks,
      conversionRate: `${conversionRate}%`
    };

    const message = `📊 تقرير (${days} يوم):\n👥: ${totalLeads} | 📋: ${totalRequests} | ✅: ${acceptedBookings} | 📈: ${conversionRate}% | 💬: ${whatsappClicks}`;

    return { success: true, data: report, message };
  } catch (err) {
    const errorMsg = String(err);
    return { success: false, error: errorMsg, message: "❌ خطأ التقرير" };
  }
}

export async function getSystemHealth(): Promise<ToolResult> {
  const supabase = getSupabaseServerClient();
  const status = "healthy";
  let pendingTasks = 0;
  try {
    const { count } = await supabase.from("parallel_task_queue").select("*", { count: "exact", head: true }).eq("status", "pending");
    pendingTasks = count || 0;
  } catch {}
  return {
    success: true,
    data: { status, pendingTasks },
    message: `✅ النظام ${status}\n🔄 مهام معلقة: ${pendingTasks}`
  };
}

export async function analyzeSEO(): Promise<ToolResult> {
  return analyzeSEOWithInput();
}

export async function analyzeSEOWithInput(input: SeoAuditInput = {}): Promise<ToolResult> {
  const siteUrl = resolveSiteUrl(input.url);
  if (!siteUrl) {
    return {
      success: false,
      message: "لا أستطيع عمل SEO audit بدون رابط الموقع. ارسل `url` (مثال: https://example.com).",
    };
  }

  const maxPages = Math.min(Math.max(input.maxPages || 4, 1), 8);
  const homeRes = await fetchText(siteUrl);
  if (!homeRes.success || !homeRes.text) {
    return {
      success: false,
      message: `فشل الوصول للصفحة الرئيسية: ${homeRes.error || "unknown"}`,
      data: { url: siteUrl, status: homeRes.status },
    };
  }

  const issues: string[] = [];
  const checks: Record<string, unknown> = {};

  const $ = loadHtml(homeRes.text);
  const title = $("title").first().text().trim();
  const description = ($('meta[name="description"]').attr("content") || "").trim();
  const canonical = ($('link[rel="canonical"]').attr("href") || "").trim();
  const robots = ($('meta[name="robots"]').attr("content") || "").trim();
  const h1Count = $("h1").length;
  const lang = ($("html").attr("lang") || "").trim();
  const viewport = ($('meta[name="viewport"]').attr("content") || "").trim();
  const ogTitle = ($('meta[property="og:title"]').attr("content") || "").trim();
  const ogDescription = ($('meta[property="og:description"]').attr("content") || "").trim();
  const ogImage = ($('meta[property="og:image"]').attr("content") || "").trim();
  const ldJsonCount = $('script[type="application/ld+json"]').length;
  const missingAlt = $("img")
    .toArray()
    .filter((img) => {
      const alt = ($(img).attr("alt") || "").trim();
      return !alt;
    }).length;

  checks.home = {
    titleLength: title.length,
    descriptionLength: description.length,
    canonicalPresent: Boolean(canonical),
    robots,
    h1Count,
    lang,
    viewportPresent: Boolean(viewport),
    og: { title: Boolean(ogTitle), description: Boolean(ogDescription), image: Boolean(ogImage) },
    structuredDataBlocks: ldJsonCount,
    imagesMissingAlt: missingAlt,
  };

  if (!title) issues.push("الصفحة الرئيسية لا تحتوي على عنوان (title).");
  if (title.length > 65) issues.push("عنوان الصفحة الرئيسية طويل جداً (يفضل <= 65 حرف).");
  if (!description) issues.push("الصفحة الرئيسية لا تحتوي على meta description.");
  if (description.length > 160) issues.push("meta description طويل جداً (يفضل <= 160 حرف).");
  if (!canonical) issues.push("لا يوجد canonical link في الصفحة الرئيسية.");
  if (robots.toLowerCase().includes("noindex")) issues.push("الصفحة الرئيسية عليها noindex (لن تظهر في Google).");
  if (h1Count === 0) issues.push("لا يوجد H1 في الصفحة الرئيسية.");
  if (h1Count > 1) issues.push("يوجد أكثر من H1 في الصفحة الرئيسية.");
  if (!lang) issues.push("وسم html بدون lang.");
  if (!viewport) issues.push("لا يوجد meta viewport (مهم للموبايل).");
  if (!ogTitle || !ogDescription || !ogImage) issues.push("OpenGraph ناقص (og:title/og:description/og:image).");
  if (ldJsonCount === 0) issues.push("لا يوجد Structured Data (JSON-LD) على الصفحة الرئيسية.");
  if (missingAlt > 0) issues.push(`يوجد ${missingAlt} صورة بدون alt في الصفحة الرئيسية.`);

  const [robotsRes, sitemapRes] = await Promise.all([
    fetchText(safeJoinUrl(siteUrl, "/robots.txt"), 8_000),
    fetchText(safeJoinUrl(siteUrl, "/sitemap.xml"), 8_000),
  ]);

  checks.robotsTxt = { exists: robotsRes.success, status: robotsRes.status };
  checks.sitemapXml = { exists: sitemapRes.success, status: sitemapRes.status };
  if (!robotsRes.success) issues.push("robots.txt غير متاح أو لا يمكن الوصول إليه.");
  if (!sitemapRes.success) issues.push("sitemap.xml غير متاح أو لا يمكن الوصول إليه.");

  // Sample a few internal pages to reduce false confidence
  const extraPages = collectInternalLinks(homeRes.text, siteUrl, Math.max(0, maxPages - 1));
  const pageChecks: Array<{ url: string; titleLength: number; hasDescription: boolean; hasCanonical: boolean; noindex: boolean }> = [];

  for (const url of extraPages) {
    const res = await fetchText(url, 8_000);
    if (!res.success || !res.text) {
      issues.push(`تعذر قراءة صفحة داخلية للفحص: ${url}`);
      continue;
    }
    const $$ = loadHtml(res.text);
    const t = $$("title").first().text().trim();
    const d = ($$('meta[name="description"]').attr("content") || "").trim();
    const c = ($$('link[rel="canonical"]').attr("href") || "").trim();
    const r = ($$('meta[name="robots"]').attr("content") || "").trim();
    pageChecks.push({
      url,
      titleLength: t.length,
      hasDescription: Boolean(d),
      hasCanonical: Boolean(c),
      noindex: r.toLowerCase().includes("noindex"),
    });
  }

  checks.samplePages = pageChecks;
  if (pageChecks.some((p) => p.noindex)) issues.push("هناك صفحات داخلية عليها noindex.");
  if (pageChecks.some((p) => !p.hasDescription)) issues.push("هناك صفحات داخلية بدون meta description.");
  if (pageChecks.some((p) => !p.hasCanonical)) issues.push("هناك صفحات داخلية بدون canonical link.");

  let score = 100;
  score -= Math.min(issues.length * 6, 60);
  if (!robotsRes.success) score -= 8;
  if (!sitemapRes.success) score -= 8;
  score = Math.max(0, Math.min(100, score));

  const status = score >= 85 ? "ممتاز" : score >= 70 ? "جيد" : score >= 50 ? "متوسط" : "ضعيف";

  return {
    success: true,
    data: { url: siteUrl, score, status, issues, checks },
    message: `SEO (${status}) ${score}/100\n${issues.length ? `ملاحظات:\n- ${issues.slice(0, 10).join("\n- ")}` : "لا ملاحظات حرجة حالياً."}`,
  };
}

export async function checkContentHealth(): Promise<ToolResult> {
  return checkContentHealthWithInput();
}

export async function checkContentHealthWithInput(input: ContentHealthInput = {}): Promise<ToolResult> {
  const siteUrl = resolveSiteUrl(input.url);
  if (!siteUrl) {
    return { success: false, message: "لا أستطيع فحص المحتوى بدون رابط الموقع. ارسل `url`." };
  }

  const maxPages = Math.min(Math.max(input.maxPages || 4, 1), 10);
  const homeRes = await fetchText(siteUrl);
  if (!homeRes.success || !homeRes.text) {
    return { success: false, message: `فشل الوصول للموقع لفحص المحتوى: ${homeRes.error || "unknown"}` };
  }

  const pages = [siteUrl, ...collectInternalLinks(homeRes.text, siteUrl, Math.max(0, maxPages - 1))];
  const perPage: Array<{ url: string; words: number; issues: string[] }> = [];
  const titleMap = new Map<string, string[]>();
  const descMap = new Map<string, string[]>();

  for (const url of pages) {
    const res = url === siteUrl ? homeRes : await fetchText(url, 10_000);
    const issues: string[] = [];

    if (!res.success || !res.text) {
      perPage.push({ url, words: 0, issues: ["تعذر قراءة الصفحة."] });
      continue;
    }

    const words = wordCountFromHtml(res.text);
    if (words < 250) issues.push(`محتوى قليل (${words} كلمة).`);

    const $ = loadHtml(res.text);
    const title = $("title").first().text().trim();
    const description = ($('meta[name="description"]').attr("content") || "").trim();
    const h1Count = $("h1").length;

    if (!title) issues.push("لا يوجد title.");
    if (!description) issues.push("لا يوجد meta description.");
    if (h1Count === 0) issues.push("لا يوجد H1.");
    if (h1Count > 1) issues.push("أكثر من H1.");

    if (title) titleMap.set(title, [...(titleMap.get(title) || []), url]);
    if (description) descMap.set(description, [...(descMap.get(description) || []), url]);

    perPage.push({ url, words, issues });
  }

  const duplicates: string[] = [];
  for (const [t, urls] of titleMap.entries()) if (urls.length > 1) duplicates.push(`title مكرر: "${t}" في ${urls.length} صفحات`);
  for (const [d, urls] of descMap.entries()) if (urls.length > 1) duplicates.push(`description مكرر في ${urls.length} صفحات (نص متكرر)`);

  const totalIssues = perPage.reduce((sum, p) => sum + p.issues.length, 0) + duplicates.length;
  const status = totalIssues === 0 ? "ممتاز" : totalIssues <= 4 ? "جيد" : "يحتاج تحسين";

  return {
    success: true,
    data: { url: siteUrl, status, totalIssues, pagesChecked: perPage.length, perPage, duplicates },
    message:
      `صحة المحتوى: ${status}\n` +
      `تم فحص ${perPage.length} صفحة.\n` +
      `عدد الملاحظات: ${totalIssues}\n` +
      `${duplicates.length ? `تكرار:\n- ${duplicates.slice(0, 5).join("\n- ")}` : ""}`.trim(),
  };
}

export async function analyzeRevenueOpportunities(): Promise<ToolResult> {
  return analyzeRevenueOpportunitiesWithInput();
}

export async function analyzeRevenueOpportunitiesWithInput(
  input: RevenueAnalysisInput = {}
): Promise<ToolResult> {
  const days = input.days || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const companyId = await resolvePrimaryCompanyId().catch(() => null);

  async function countTable(table: string) {
    // Try tenant-scoped first, then fallback if company_id column does not exist.
    const base = supabaseService.from(table).select("*", { count: "exact", head: true }).gte("created_at", startDate);
    const scoped = companyId ? await base.eq("company_id", companyId) : await base;
    if (!scoped.error) return { success: true, count: scoped.count || 0, scoped: Boolean(companyId) };

    const msg = scoped.error.message || "";
    const companyColumnMissing = msg.includes("company_id") || msg.toLowerCase().includes("column") && msg.includes("company_id");
    if (companyId && companyColumnMissing) {
      const unscoped = await supabaseService.from(table).select("*", { count: "exact", head: true }).gte("created_at", startDate);
      if (!unscoped.error) return { success: true, count: unscoped.count || 0, scoped: false };
      return { success: false, error: unscoped.error.message };
    }

    return { success: false, error: scoped.error.message };
  }

  const [viewsCount, inquiriesCount, conversionsCount, requestsCount] = await Promise.all([
    countTable("page_views"),
    countTable("inquiries"),
    countTable("conversions"),
    countTable("requests"),
  ]);

  if (!viewsCount.success && STRICT_MODE) {
    return { success: false, message: `تعذر قراءة page_views: ${viewsCount.error}` };
  }

  // Sum conversion value (if table exists and has "value" column)
  let conversionValue = 0;
  if (conversionsCount.success && (conversionsCount.count || 0) > 0) {
    const q = supabaseService.from("conversions").select("value, created_at").gte("created_at", startDate);
    const { data, error } = companyId ? await q.eq("company_id", companyId) : await q;
    if (!error && Array.isArray(data)) {
      conversionValue = data.reduce((sum, row) => sum + (typeof row.value === "number" ? row.value : 0), 0);
    }
  }

  const pageViews = viewsCount.success ? viewsCount.count : 0;
  const inquiries = inquiriesCount.success ? inquiriesCount.count : 0;
  const conversions = conversionsCount.success ? conversionsCount.count : 0;
  const requests = requestsCount.success ? requestsCount.count : 0;

  const inquiryRate = pageViews > 0 ? inquiries / pageViews : 0;
  const conversionRate = pageViews > 0 ? conversions / pageViews : 0;
  const avgConversionValue = conversions > 0 ? conversionValue / conversions : 0;

  const opportunities: Array<{ name: string; why: string; potentialMonthly?: number }> = [];

  if (pageViews > 0 && inquiryRate < 0.01) {
    opportunities.push({
      name: "رفع معدل الاستفسار",
      why: `معدل الاستفسار منخفض (${(inquiryRate * 100).toFixed(2)}%). تحسين CTA والنماذج قد يرفعه.`,
      potentialMonthly: Math.round(avgConversionValue * conversions * 0.15) || undefined,
    });
  }

  if (pageViews > 0 && conversionRate < 0.005) {
    opportunities.push({
      name: "تحسين التحويل",
      why: `معدل التحويل منخفض (${(conversionRate * 100).toFixed(2)}%). تحسين تجربة المستخدم والمتابعة قد يزيده.`,
      potentialMonthly: Math.round(avgConversionValue * conversions * 0.2) || undefined,
    });
  }

  if (requests > 0 && conversions === 0) {
    opportunities.push({
      name: "قياس قيمة التحويل",
      why: "يوجد طلبات/حجوزات لكن لا توجد تحويلات بقيمة. راجعي الربط بين الطلبات والتحويلات.",
    });
  }

  // Keep AdSense as an option but mark it as assumption-based
  if (pageViews > 1000) {
    opportunities.push({
      name: "AdSense (تقديري)",
      why: `لديك ${pageViews} مشاهدة صفحة خلال ${days} يوم. يمكن اختبار AdSense إذا المحتوى مناسب.`,
    });
  }

  return {
    success: true,
    data: {
      periodDays: days,
      metrics: { pageViews, inquiries, conversions, conversionValue, requests, avgConversionValue },
      rates: { inquiryRate, conversionRate },
      opportunities,
      notes: [
        "أي رقم عائد/تأثير هنا تقديري ويعتمد على جودة القياس داخل جداول analytics لديك.",
        companyId ? "تمت محاولة التصفية بحسب company_id." : "لم يتم تحديد company_id (تم حساب أرقام عامة).",
      ],
    },
    message:
      `تحليل الإيرادات (${days} يوم)\n` +
      `- Page Views: ${pageViews}\n` +
      `- Inquiries: ${inquiries}\n` +
      `- Conversions: ${conversions} (قيمة: ${conversionValue})\n` +
      `- Requests: ${requests}\n` +
      `الفرص: ${opportunities.length}\n` +
      (opportunities.length ? `- ${opportunities.slice(0, 5).map((o) => o.name).join("\n- ")}` : "لا فرص واضحة من البيانات الحالية."),
  };
}

export async function createSection(input: CreateSectionInput): Promise<ToolResult> {
  try {
    if (!input.name) return { success: false, message: "اسم القسم مطلوب" };

    const companyId = await resolvePrimaryCompanyId();
    const slug = input.name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || `section-${Date.now()}`;

    // Determine display_order (append to end)
    const { data: lastOrderRow } = await supabaseService
      .from("room_sections")
      .select("display_order")
      .eq("company_id", companyId)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder =
      typeof lastOrderRow?.display_order === "number" ? lastOrderRow.display_order + 1 : 1;

    const insertPayload = {
      company_id: companyId,
      slug,
      name: input.name,
      name_ar: input.name,
      description: input.description || null,
      display_order: nextOrder,
      is_active: true,
      metadata: { imageIds: input.imageIds || [] },
    };

    const { data, error } = await supabaseService
      .from("room_sections")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      return { success: false, message: `فشل إنشاء القسم: ${error.message}` };
    }

    return {
      success: true,
      data,
      message: `✅ تم إنشاء قسم "${input.name}" (slug: ${slug})`,
    };
  } catch (err) {
    return { success: false, message: `خطأ أثناء إنشاء القسم: ${String(err)}` };
  }
}

// NEW PHASE 3 TOOLS
export async function addProduct(input: ProductInput): Promise<ToolResult> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("products").insert(input).select().single();
    if (error) return { success: false, message: error.message };
    return { success: true, data, message: `🛍️ "${input.name}" مضاف (${input.price} ر.س)` };
  } catch (e) { return { success: false, message: String(e) }; }
}

export async function listProducts(): Promise<ToolResult> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("products").select("name, price");
  const msg =
    data?.slice(0, 5).map((p: { name?: string; price?: number }) => `- ${p.name}: ${p.price}`).join("\n") ||
    "لا منتجات";
  return { success: true, data, message: `📦 ${data?.length || 0}:\n${msg}` };
}

export async function createBackup(input?: { userId?: string; tables?: string[] }): Promise<ToolResult> {
  const tablesRequested = input?.tables?.length
    ? input.tables
    : ["site_settings", "automation_rules", "room_sections", "products"];

  const companyId = await resolvePrimaryCompanyId().catch(() => null);
  const startedAt = new Date().toISOString();
  const safeUserId =
    typeof input?.userId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.userId)
      ? input.userId
      : null;

  const backupData: Record<string, unknown> = {
    meta: {
      startedAt,
      companyId,
      requestedTables: tablesRequested,
      strictMode: STRICT_MODE,
    },
    tables: {},
  };

  const errors: string[] = [];

  for (const table of tablesRequested) {
    try {
      const base = supabaseService.from(table).select("*");
      const scoped = companyId ? await base.eq("company_id", companyId) : await base;
      if (scoped.error) {
        const msg = scoped.error.message || "";
        const companyColumnMissing = msg.includes("company_id") || (msg.toLowerCase().includes("column") && msg.includes("company_id"));
        if (companyId && companyColumnMissing) {
          const unscoped = await supabaseService.from(table).select("*");
          if (unscoped.error) throw unscoped.error;
          (backupData.tables as Record<string, unknown>)[table] = unscoped.data || [];
        } else {
          throw scoped.error;
        }
      } else {
        (backupData.tables as Record<string, unknown>)[table] = scoped.data || [];
      }
    } catch (e) {
      errors.push(`${table}: ${String(e)}`);
      (backupData.tables as Record<string, unknown>)[table] = null;
    }
  }

  const json = JSON.stringify(backupData);
  const sizeBytes = new TextEncoder().encode(json).length;

  const status = errors.length ? "failed" : "completed";
  const errorMessage = errors.length ? errors.slice(0, 10).join(" | ") : null;

  const { data, error } = await supabaseService
    .from("backups")
    .insert({
      user_id: safeUserId,
      backup_data: backupData,
      size_bytes: sizeBytes,
      status,
      backup_type: "manual",
      tables_included: tablesRequested,
      error_message: errorMessage,
    })
    .select("id, status, created_at")
    .single();

  if (error) {
    return { success: false, message: `فشل حفظ النسخة الاحتياطية في قاعدة البيانات: ${error.message}` };
  }

  if (errors.length) {
    return {
      success: false,
      data: { backupId: data?.id, status: data?.status, createdAt: data?.created_at, errors },
      message: `⚠️ تم إنشاء نسخة احتياطية رقم ${data?.id} لكن بها أخطاء.\n- ${errors.slice(0, 6).join("\n- ")}`,
    };
  }

  return {
    success: true,
    data: { backupId: data?.id, status: data?.status, createdAt: data?.created_at, sizeBytes, tables: tablesRequested },
    message: `💾 تم إنشاء نسخة احتياطية رقم ${data?.id} (حجم: ${sizeBytes} بايت)`,
  };
}

export async function optimizeSpeed(): Promise<ToolResult> {
  return optimizeSpeedWithInput();
}

export async function optimizeSpeedWithInput(input: SpeedAuditInput = {}): Promise<ToolResult> {
  const siteUrl = resolveSiteUrl(input.url);
  if (!siteUrl) {
    return { success: false, message: "لا أستطيع فحص السرعة بدون رابط الموقع. ارسل `url`." };
  }

  const strategy = input.strategy || "mobile";
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;

  const apiUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  apiUrl.searchParams.set("url", siteUrl);
  apiUrl.searchParams.set("strategy", strategy);
  if (apiKey) apiUrl.searchParams.set("key", apiKey);

  try {
    const res = await fetch(apiUrl.toString(), { signal: AbortSignal.timeout(20_000) });
    const json = (await res.json().catch(() => null)) as any;

    if (!res.ok || !json) {
      const msg = json?.error?.message || `HTTP ${res.status}`;
      return { success: false, message: `فشل فحص السرعة عبر PageSpeed: ${msg}`, data: { url: siteUrl, strategy, status: res.status } };
    }

    const lighthouse = json.lighthouseResult;
    const audits = lighthouse?.audits || {};
    const perfScore = typeof lighthouse?.categories?.performance?.score === "number"
      ? Math.round(lighthouse.categories.performance.score * 100)
      : null;

    const metrics = {
      fcp: audits["first-contentful-paint"]?.displayValue,
      lcp: audits["largest-contentful-paint"]?.displayValue,
      cls: audits["cumulative-layout-shift"]?.displayValue,
      tbt: audits["total-blocking-time"]?.displayValue,
      speedIndex: audits["speed-index"]?.displayValue,
    };

    const opportunityIds = [
      "render-blocking-resources",
      "unused-css-rules",
      "unused-javascript",
      "modern-image-formats",
      "uses-optimized-images",
      "uses-text-compression",
      "uses-responsive-images",
      "efficient-animated-content",
      "server-response-time",
    ];

    const opportunities = opportunityIds
      .map((id) => audits[id])
      .filter((a: any) => a && typeof a.title === "string")
      .map((a: any) => ({
        title: a.title as string,
        displayValue: a.displayValue as string | undefined,
        score: typeof a.score === "number" ? a.score : undefined,
      }))
      .filter((a) => a.score !== undefined && a.score < 1)
      .slice(0, 8);

    return {
      success: true,
      data: { url: siteUrl, strategy, performanceScore: perfScore, metrics, opportunities },
      message:
        `فحص السرعة (${strategy})\n` +
        `- Performance: ${perfScore ?? "غير متاح"}\n` +
        `- LCP: ${metrics.lcp || "?"} | CLS: ${metrics.cls || "?"} | TBT: ${metrics.tbt || "?"}\n` +
        (opportunities.length ? `أهم فرص التحسين:\n- ${opportunities.map((o) => o.title).join("\n- ")}` : "لا توجد فرص واضحة في التقرير."),
    };
  } catch (e) {
    return { success: false, message: `خطأ أثناء فحص السرعة: ${String(e)}` };
  }
}

export async function setupAdSense(accountId: string): Promise<ToolResult> {
  const raw = (accountId || "").trim();
  if (!raw) return { success: false, message: "أرسل `accountId` بوضوح. مثال: pub-1234567890 أو ca-pub-1234567890." };

  const client = raw.startsWith("ca-pub-") ? raw : raw.startsWith("pub-") ? `ca-${raw}` : raw;
  if (!/^ca-pub-\d+$/i.test(client)) {
    return { success: false, message: `accountId غير صالح: "${raw}". المتوقع: pub-######### أو ca-pub-#########.` };
  }

  const save = await updateSiteSetting({
    key: "seo",
    value: {
      adsenseEnabled: true,
      adsenseClient: client,
    },
  });

  if (!save.success) return save;

  return {
    success: true,
    data: { adsenseClient: client },
    message: `✅ تم تفعيل AdSense وحفظ client="${client}".`,
  };
}

export async function generateAffiliateLinks(partners: string[]): Promise<ToolResult> {
  const siteUrl = resolveSiteUrl();
  if (!siteUrl) return { success: false, message: "لا أستطيع توليد روابط إحالة بدون NEXT_PUBLIC_SITE_URL (أو ارسل رابط الموقع)."};

  if (!Array.isArray(partners) || partners.length === 0) {
    return { success: false, message: "اذكر أسماء الشركاء (مثال: IKEA, Amazon, Noon)." };
  }

  const defaults: Record<string, string> = {
    amazon: "https://www.amazon.eg/",
    ikea: "https://www.ikea.com/",
    noon: "https://www.noon.com/",
  };

  const unknown: string[] = [];
  const links = partners.map((p) => {
    const name = String(p || "").trim();
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const dest = defaults[key];
    const slug = key || "partner";
    if (!dest) unknown.push(name);
    const to = encodeURIComponent(dest || "");
    return { partner: name, url: dest || null, link: dest ? `${siteUrl}/aff/${slug}?to=${to}` : null };
  });

  if (unknown.length) {
    return {
      success: false,
      data: { links, unknownPartners: unknown },
      message: `لا أستطيع إنشاء روابط إحالة "حقيقية" لهؤلاء بدون رابط وجهتهم: ${unknown.join(", ")}.\nأرسل لكل شريك رابط الموقع/المنتج وسأولد روابط تتبع له.`,
    };
  }

  return {
    success: true,
    data: { links },
    message: `🔗 تم توليد ${links.length} رابط إحالة:\n- ${links.slice(0, 5).map((l) => l.link).join("\n- ")}`,
  };
}

// UNIVERSAL MIND TOOLS
export async function webSearch(input: WebSearchInput): Promise<ToolResult> {
  try {
    // Using DuckDuckGo HTML search as a free fallback
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`);
    const html = await res.text();
    // Very basic extraction of result snippets
    const snippets = html.match(/<a class="result__snippet[^>]*>(.*?)<\/a>/g)?.slice(0, 5)
      .map(s => s.replace(/<[^>]+>/g, '').trim()) || [];
    
    if (snippets.length === 0) {
      const looksBlocked = /captcha|blocked|unusual traffic|verify/i.test(html);
      if (looksBlocked) {
        return { success: false, message: "تعذر إتمام webSearch: مزود البحث حظر الطلب (Captcha/Block)." };
      }
      return { success: true, data: [], message: `🔍 بحثت عن: ${input.query}\nلم أجد نتائج واضحة.` };
    }
    return { success: true, data: snippets, message: `🔍 بحثت عن: ${input.query}` };
  } catch (e) {
    return { success: false, message: `خطأ في البحث: ${String(e)}` };
  }
}

export async function readWebsite(input: ReadWebsiteInput): Promise<ToolResult> {
  try {
    const res = await fetch(input.url);
    const text = await res.text();
    // Extract a chunk of text
    const cleanText = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                          .replace(/<[^>]+>/g, ' ')
                          .replace(/\s+/g, ' ')
                          .trim()
                          .substring(0, 2000);
    return { success: true, data: cleanText, message: `📄 تمت قراءة ${input.url}` };
  } catch (e) {
    return { success: false, message: `خطأ في القراءة: ${String(e)}` };
  }
}

// CRITICAL: TOOL_DEFINITIONS (fixes app/api/admin/architect/command/route.ts)
export const TOOL_DEFINITIONS = [
  {
    name: "createAutomationRule",
    description: "إنشاء قاعدة أتمتة",
    parameters: {
      type: "object",
      properties: { name: { type: "string" }, trigger: { type: "string", enum: ["page_visit", "form_submit", "booking_status_changed"] } },
      required: ["name", "trigger"]
    }
  },
  {
    name: "updateSiteSetting",
    description: "تحديث إعدادات الموقع",
    parameters: {
      type: "object",
      properties: { key: { type: "string", enum: ["theme", "seo", "general"] }, value: { type: "object" } },
      required: ["key", "value"]
    }
  },
  {
    name: "getAnalyticsReport",
    description: "تقرير تحليلات",
    parameters: { type: "object", properties: { days: { type: "number", enum: [7, 30, 90] } } }
  },
  {
    name: "getSystemHealth",
    description: "حالة النظام"
  },
  {
    name: "analyzeSEO",
    description: "تحليل SEO",
    parameters: {
      type: "object",
      properties: { url: { type: "string" }, maxPages: { type: "number" } }
    }
  },
  {
    name: "checkContentHealth",
    description: "صحة المحتوى",
    parameters: {
      type: "object",
      properties: { url: { type: "string" }, maxPages: { type: "number" } }
    }
  },
  {
    name: "analyzeRevenueOpportunities",
    description: "فرص الإيرادات",
    parameters: {
      type: "object",
      properties: { days: { type: "number", enum: [7, 30, 90] } }
    }
  },
  {
    name: "createSection",
    description: "إنشاء قسم",
    parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] }
  },
  {
    name: "addProduct",
    description: "إضافة منتج",
    parameters: { type: "object", properties: { name: { type: "string" }, price: { type: "number" } }, required: ["name", "price"] }
  },
  {
    name: "listProducts",
    description: "قائمة المنتجات"
  },
  {
    name: "createBackup",
    description: "نسخ احتياطي",
    parameters: {
      type: "object",
      properties: { tables: { type: "array", items: { type: "string" } } }
    }
  },
  {
    name: "optimizeSpeed",
    description: "تحسين السرعة",
    parameters: {
      type: "object",
      properties: { url: { type: "string" }, strategy: { type: "string", enum: ["mobile", "desktop"] } }
    }
  },
  {
    name: "setupAdSense",
    description: "إعداد AdSense",
    parameters: { type: "object", properties: { accountId: { type: "string" } }, required: ["accountId"] }
  },
  {
    name: "generateAffiliateLinks",
    description: "روابط الإحالة",
    parameters: { type: "object", properties: { partners: { type: "array", items: { type: "string" } } }, required: ["partners"] }
  },
  {
    name: "webSearch",
    description: "البحث في الإنترنت عن معلومات حية",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
  },
  {
    name: "readWebsite",
    description: "قراءة محتوى موقع إلكتروني",
    parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }
  }
];

export async function executeTool(toolName: string, params: unknown): Promise<ToolResult> {
  switch (toolName) {
    case "createAutomationRule": return createAutomationRule(params as AutomationRuleInput);
    case "updateSiteSetting": return updateSiteSetting(params as SiteSettingInput);
    case "getAnalyticsReport": return getAnalyticsReport(params as AnalyticsPeriod);
    case "getSystemHealth": return getSystemHealth();
    case "analyzeSEO": return analyzeSEOWithInput((params || {}) as SeoAuditInput);
    case "checkContentHealth": return checkContentHealthWithInput((params || {}) as ContentHealthInput);
    case "analyzeRevenueOpportunities": return analyzeRevenueOpportunitiesWithInput((params || {}) as RevenueAnalysisInput);
    case "createSection": return createSection(params as CreateSectionInput);
    case "addProduct": return addProduct(params as ProductInput);
    case "listProducts": return listProducts();
    case "createBackup": return createBackup((params || {}) as { userId?: string; tables?: string[] });
    case "optimizeSpeed": return optimizeSpeedWithInput((params || {}) as SpeedAuditInput);
    case "setupAdSense": {
      const input = (params || {}) as { accountId?: string };
      return setupAdSense(input.accountId || "");
    }
    case "generateAffiliateLinks": {
      const input = (params || {}) as { partners?: string[] };
      return generateAffiliateLinks(input.partners || []);
    }
    case "webSearch": return webSearch(params as WebSearchInput);
    case "readWebsite": return readWebsite(params as ReadWebsiteInput);
    default:
      return { success: false, error: `Unknown tool: ${toolName}`, message: `❌ أداة "${toolName}" غير معروفة` };
  }
}


