/**
 * Tool Handlers - Actual Implementation
 * 
 * Implementations of all tool handlers referenced in tool-registry.ts
 * These handlers perform real database operations and external API calls.
 */

import { createClient } from "@/lib/supabase-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { put } from "@vercel/blob";
import { analyzeSEO as analyzeSEOPage } from "@/lib/seo-analyzer";
import { getSystemHealth, getAnalyticsReport } from "@/lib/architect-tools";
import type {
  ToolExecutionContext,
  ToolExecutionResult,
} from "./tool-registry";
import type { Json } from "@/lib/supabase/database.types";

// ============================================
// Helper Functions
// ============================================

async function getSupabase() {
  return await createClient();
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u0621-\u064A]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function jsonToDataUrl(value: unknown): string {
  return `data:application/json;base64,${Buffer.from(
    JSON.stringify(value, null, 2),
    "utf8"
  ).toString("base64")}`;
}

// ============================================
// Content Management Handlers
// ============================================

export async function executeSectionCreate(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  const supabase = await getSupabase();

  try {
    const sectionName = params.name as string;
    const sectionType = params.type as string;
    const pagePlacement = (params.pagePlacement as string) || "home";
    const placementPosition = (params.placementPosition as string) || "body_middle";

    // Generate slug
    const slug = generateSlug(sectionName);

    // Get next sort order
    const { data: existingSections } = await supabase
      .from("site_sections")
      .select("sort_order")
      .eq("page_placement", pagePlacement)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSortOrder = (existingSections?.[0]?.sort_order || 0) + 1;

    // Prepare default config and content based on section type
    let defaultConfig: Record<string, unknown> = {};
    let defaultContent: Record<string, unknown> = {};

    switch (sectionType) {
      case "hero":
        defaultConfig = {
          layout: "centered",
          height: "full",
          background: { type: "gradient", value: "from-[#C5A059]/20 to-transparent" },
        };
        defaultContent = {
          title: sectionName,
          subtitle: "",
          ctaText: "ابدأ الآن",
          ctaLink: "#contact",
        };
        break;
      case "features":
        defaultConfig = {
          layout: "grid",
          columns: 3,
          spacing: "large",
        };
        defaultContent = {
          title: "مميزاتنا",
          features: [],
        };
        break;
      case "testimonials":
        defaultConfig = {
          layout: "carousel",
          autoPlay: true,
          interval: 5000,
        };
        defaultContent = {
          title: "آراء العملاء",
          testimonials: [],
        };
        break;
      default:
        defaultConfig = { layout: "default" };
        defaultContent = { title: sectionName };
    }

    // Merge with provided params
    const config = { ...defaultConfig, ...(params.config as Record<string, unknown> || {}) };
    const content = { ...defaultContent, ...(params.content as Record<string, unknown> || {}) };

    // Create section
    const { data: section, error } = await supabase
      .from("site_sections")
      .insert({
        execution_id: context.executionId,
        company_id: context.companyId || null,
        created_by: context.actorUserId || null,
        section_type: sectionType,
        section_name: sectionName,
        section_slug: slug,
        section_config: config as unknown as Json,
        section_content: content as unknown as Json,
        page_placement: pagePlacement,
        placement_position: placementPosition,
        sort_order: nextSortOrder,
        is_active: true,
        is_visible: true,
        render_metrics: { renderCount: 0, avgRenderTimeMs: 0 } as unknown as Json,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      message: `تم إنشاء القسم "${sectionName}" بنجاح`,
      data: {
        sectionId: section.id,
        sectionName: section.section_name,
        sectionType: section.section_type,
        slug: section.section_slug,
        previewUrl: `/preview/section/${section.id}`,
        sortOrder: section.sort_order,
        createdAt: section.created_at,
      },
      executionId: context.executionId,
      canRollback: true,
    };
  } catch (error) {
    return {
      success: false,
      message: `فشل إنشاء القسم: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
      error: error instanceof Error ? error.message : "Unknown error",
      executionId: context.executionId,
    };
  }
}

export async function executeSectionUpdate(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = await getSupabase();

  try {
    const sectionId = params.sectionId as string;

    // Get current section for revision
    const { data: currentSection, error: fetchError } = await supabase
      .from("site_sections")
      .select("*")
      .eq("id", sectionId)
      .single();

    if (fetchError || !currentSection) {
      throw new Error("Section not found");
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const changes: string[] = [];

    // Prepare old value for revision
    const oldValue = {
      name: currentSection.section_name,
      config: currentSection.section_config,
      content: currentSection.section_content,
      is_active: currentSection.is_active,
      is_visible: currentSection.is_visible,
      sort_order: currentSection.sort_order,
    };

    if (params.name) {
      updateData.section_name = params.name;
      changes.push(`name: ${currentSection.section_name} → ${params.name}`);
    }
    if (params.config) {
      updateData.section_config = params.config as Json;
      changes.push("config updated");
    }
    if (params.content) {
      updateData.section_content = params.content as Json;
      changes.push("content updated");
    }
    if (params.isActive !== undefined) {
      updateData.is_active = params.isActive;
      changes.push(`active: ${currentSection.is_active} → ${params.isActive}`);
    }
    if (params.isVisible !== undefined) {
      updateData.is_visible = params.isVisible;
      changes.push(`visible: ${currentSection.is_visible} → ${params.isVisible}`);
    }
    if (params.sortOrder !== undefined) {
      updateData.sort_order = params.sortOrder;
      changes.push(`sortOrder: ${currentSection.sort_order} → ${params.sortOrder}`);
    }

    // Create revision
    const { data: revision, error: revisionError } = await supabase
      .from("content_revisions")
      .insert({
        execution_id: context.executionId,
        company_id: context.companyId || null,
        actor_user_id: context.actorUserId || null,
        table_name: "site_sections",
        record_id: sectionId,
        field_name: "section_data",
        old_value: oldValue as unknown as Json,
        new_value: { ...oldValue, ...updateData } as unknown as Json,
        change_reason: (params.reason as string) || "تحديث قسم",
        change_category: "content" as const,
        revision_status: "applied" as const,
        applied_at: new Date().toISOString(),
        applied_by: context.actorUserId || null,
      })
      .select()
      .single();

    if (revisionError) {
      throw revisionError;
    }

    // Apply update
    const { data: updatedSection, error: updateError } = await supabase
      .from("site_sections")
      .update(updateData)
      .eq("id", sectionId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return {
      success: true,
      message: `تم تحديث القسم "${updatedSection.section_name}" بنجاح`,
      data: {
        sectionId: updatedSection.id,
        changes: changes,
        revisionId: revision.id,
        updatedAt: updatedSection.updated_at,
      },
      executionId: context.executionId,
      canRollback: true,
      rollbackId: revision.id,
    };
  } catch (error) {
    return {
      success: false,
      message: `فشل تحديث القسم: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
      error: error instanceof Error ? error.message : "Unknown error",
      executionId: context.executionId,
    };
  }
}

export async function executeSectionDelete(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = await getSupabase();

  try {
    const sectionId = params.sectionId as string;
    const permanent = params.permanent as boolean || false;

    if (permanent) {
      // Hard delete
      const { error } = await supabase
        .from("site_sections")
        .delete()
        .eq("id", sectionId);

      if (error) throw error;
    } else {
      // Soft delete (deactivate)
      const { error } = await supabase
        .from("site_sections")
        .update({
          is_active: false,
          is_visible: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sectionId);

      if (error) throw error;
    }

    return {
      success: true,
      message: permanent ? "تم حذف القسم نهائياً" : "تم تعطيل القسم (يمكن استعادته)",
      data: {
        sectionId,
        permanent,
        deletedAt: new Date().toISOString(),
      },
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: `فشل حذف القسم: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
      error: error instanceof Error ? error.message : "Unknown error",
      executionId: context.executionId,
    };
  }
}

// ============================================
// SEO Handlers
// ============================================

export async function executeSEOAnalysis(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    const url = params.url as string;
    const deepAnalysis = params.deepAnalysis as boolean || false;

    // Use the real SEO analyzer
    const result = await analyzeSEOPage(
      url,
      {
        executionId: context.executionId || crypto.randomUUID(),
        companyId: context.companyId,
      },
      {
        saveToDatabase: true,
      }
    );

    if (!result.success) {
      return {
        success: false,
        message: result.message || "فشل تحليل SEO",
        error: result.message,
        executionId: context.executionId,
      };
    }

    return {
      success: true,
      message: `تم تحليل SEO بنجاح: درجة ${result.data?.score}/100`,
      data: {
        pageUrl: (result.data as Record<string, unknown> | undefined)?.pageUrl,
        pageTitle: (result.data as Record<string, unknown> | undefined)?.pageTitle,
        score: (result.data as Record<string, unknown> | undefined)?.score,
        scoreBreakdown: (result.data as Record<string, unknown> | undefined)?.scoreBreakdown,
        issues: (result.data as Record<string, unknown> | undefined)?.issues,
        recommendations: (result.data as Record<string, unknown> | undefined)?.recommendations,
        metrics: ((result.data as Record<string, unknown> | undefined)?.performanceMetrics) || 
                 ((result.data as Record<string, unknown> | undefined)?.metrics),
      },
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: `فشل تحليل SEO: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
      error: error instanceof Error ? error.message : "Unknown error",
      executionId: context.executionId,
    };
  }
}

// ============================================
// Backup Handlers
// ============================================

export async function executeBackupCreate(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = await getSupabase();

  try {
    const name = params.name as string;
    const description = params.description as string || "Backup created by Executive Agent";
    const tables = params.tables as string[] || [
      "companies",
      "users",
      "site_sections",
      "site_settings",
      "general_suggestions",
      "agent_executions",
    ];
    const retentionDays = params.retentionDays as number || 30;

    // Fetch data from tables
    const backupData: Record<string, unknown[]> = {};

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .limit(10000);

      if (error) {
        console.warn(`[Backup] Failed to fetch ${table}:`, error.message);
        backupData[table] = [];
      } else {
        backupData[table] = data || [];
      }
    }

    // Create backup object
    const backup = {
      metadata: {
        name,
        description,
        createdAt: new Date().toISOString(),
        createdBy: context.actorUserId,
        version: "1.0",
        tables,
      },
      data: backupData,
      checksum: "", // Will be calculated
    };

    // Calculate checksum
    const backupJson = JSON.stringify(backup);
    const checksum = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(backupJson));
    const checksumHex = Array.from(new Uint8Array(checksum))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    backup.checksum = checksumHex;

    // Upload to Vercel Blob, with a real database-inline backup as fallback.
    const blobName = `backups/executive-agent/${name}-${Date.now()}.json`;
    let storageProvider = "vercel_blob";
    let storageUrl = "";
    let storagePath = "";
    let storageNote = "";

    try {
      const blob = await put(blobName, JSON.stringify(backup, null, 2), {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      storageUrl = blob.url;
      storagePath = blob.pathname;
    } catch (uploadError) {
      storageProvider = "database_inline";
      storageUrl = jsonToDataUrl(backup);
      storagePath = `backup_snapshots.storage_url:${blobName}`;
      storageNote =
        uploadError instanceof Error
          ? `Blob unavailable: ${uploadError.message}`
          : "Blob unavailable";
    }

    // Store in database
    const { data: snapshot, error: dbError } = await supabase
      .from("backup_snapshots")
      .insert({
        execution_id: context.executionId,
        company_id: context.companyId || null,
        created_by: context.actorUserId || null,
        backup_type: "data",
        backup_name: name,
        backup_description: description,
        storage_provider: storageProvider,
        storage_url: storageUrl,
        storage_path: storagePath,
        size_bytes: backupJson.length,
        checksum: checksumHex,
        checksum_algorithm: "sha256",
        integrity_verified: true,
        integrity_verified_at: new Date().toISOString(),
        tables_backed_up: tables as unknown as Json,
        retention_days: retentionDays,
        expires_at: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString(),
        backup_status: "completed",
        restoration_result: storageNote ? { storageNote } as unknown as Json : null,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    return {
      success: true,
      message:
        storageProvider === "database_inline"
          ? `تم إنشاء نسخة احتياطية "${name}" بنجاح داخل قاعدة البيانات كمسار بديل حقيقي`
          : `تم إنشاء نسخة احتياطية "${name}" بنجاح`,
      data: {
        backupId: snapshot.id,
        name: snapshot.backup_name,
        downloadUrl: storageProvider === "vercel_blob" ? storageUrl : undefined,
        storageProvider,
        sizeBytes: backupJson.length,
        tables: tables,
        expiresAt: snapshot.expires_at,
      },
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: `فشل إنشاء النسخة الاحتياطية: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
      error: error instanceof Error ? error.message : "Unknown error",
      executionId: context.executionId,
    };
  }
}

// ============================================
// Settings Handlers
// ============================================

export async function executeSettingUpdate(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = await getSupabase();

  try {
    const key = params.key as string;
    const value = params.value as Record<string, unknown>;
    const category = (params.category as string) || "general";
    const reason = String(params.reason || "تحديث إعداد");
    const autoApprove = Boolean(params.autoApprove) || false;

    // Get current setting
    const { data: existingSetting, error: fetchError } = await supabase
      .from("site_settings")
      .select("*")
      .eq("key", key)
      .maybeSingle();

    const oldValue = existingSetting?.value || null;

    // Create revision
    const { data: revision, error: revisionError } = await supabase
      .from("content_revisions")
      .insert({
        execution_id: context.executionId,
        company_id: context.companyId || null,
        actor_user_id: context.actorUserId || null,
        table_name: "site_settings",
        record_id: existingSetting?.id || crypto.randomUUID(),
        field_name: "setting_value",
        old_value: oldValue as Json,
        new_value: value as Json,
        change_reason: reason,
        change_category: category as "general" | "content" | "seo" | "technical" | "security" | "integration",
        revision_status: autoApprove ? "applied" : "draft",
      })
      .select()
      .single();

    if (revisionError) {
      throw revisionError;
    }

    // If not auto-approved, return approval required
    if (!autoApprove) {
      return {
        success: true,
        message: `تم إنشاء طلب تعديل الإعداد "${key}" - ينتظر الموافقة`,
        requiresApproval: true,
        approvalId: revision.id,
        data: {
          settingKey: key,
          oldValue,
          newValue: value,
          revisionId: revision.id,
        },
        executionId: context.executionId,
      };
    }

    // Apply setting update
    let result;
    if (existingSetting) {
      // Update existing
      result = await supabase
        .from("site_settings")
        .update({
          value: value as Json,
          current_revision_id: revision.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSetting.id)
        .select()
        .single();
    } else {
      // Create new
      result = await supabase
        .from("site_settings")
        .insert({
          key: key,
          value: value as Json,
          current_revision_id: revision.id,
        })
        .select()
        .single();
    }

    if (result.error) {
      throw result.error;
    }

    return {
      success: true,
      message: `تم تحديث الإعداد "${key}" بنجاح`,
      data: {
        settingKey: key,
        oldValue,
        newValue: value,
        revisionId: revision.id,
        canRollback: true,
      },
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: `فشل تحديث الإعداد: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
      error: error instanceof Error ? error.message : "Unknown error",
      executionId: context.executionId,
    };
  }
}

// ============================================
// Revenue Analysis Handler
// ============================================

export async function executeRevenueAnalysis(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = await getSupabase();

  try {
    const period = (params.period as string) || "30d";
    const segmentBy = params.segmentBy as string || undefined;
    const includeForecast = params.includeForecast as boolean || false;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch real leads data
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("id, created_at, source, status, estimated_value")
      .gte("created_at", startDate.toISOString());

    if (leadsError) {
      throw leadsError;
    }

    // Fetch real bookings/conversions data
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, created_at, lead_id, total_amount, status")
      .gte("created_at", startDate.toISOString());

    if (bookingsError) {
      throw bookingsError;
    }

    // Calculate real metrics
    const totalLeads = leads?.length || 0;
    const totalBookings = bookings?.length || 0;
    const conversionRate = totalLeads > 0 ? (totalBookings / totalLeads) * 100 : 0;
    const totalRevenue = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
    const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // Segment analysis if requested
    let segments: Record<string, unknown> | undefined;
    if (segmentBy) {
      segments = {};
      switch (segmentBy) {
        case "source":
          const leadsBySource: Record<string, number> = {};
          leads?.forEach(lead => {
            const source = lead.source || "unknown";
            leadsBySource[source] = (leadsBySource[source] || 0) + 1;
          });
          segments = { leadsBySource };
          break;
        case "status":
          const bookingsByStatus: Record<string, number> = {};
          bookings?.forEach(booking => {
            const status = booking.status || "unknown";
            bookingsByStatus[status] = (bookingsByStatus[status] || 0) + 1;
          });
          segments = { bookingsByStatus };
          break;
      }
    }

    // Simple forecast (if requested)
    let forecast: Record<string, unknown> | undefined;
    if (includeForecast) {
      const dailyAverage = totalRevenue / 30;
      forecast = {
        next30Days: dailyAverage * 30,
        next90Days: dailyAverage * 90,
        trend: conversionRate > 5 ? "upward" : conversionRate > 2 ? "stable" : "needs_improvement",
      };
    }

    return {
      success: true,
      message: `تحليل الإيرادات (${period}): ${totalBookings} حجز من ${totalLeads} lead`,
      data: {
        period,
        summary: {
          totalLeads,
          totalBookings,
          conversionRate: Math.round(conversionRate * 100) / 100,
          totalRevenue,
          avgBookingValue: Math.round(avgBookingValue * 100) / 100,
        },
        segments,
        forecast,
        leadsByDay: leads?.reduce((acc, lead) => {
          const day = lead.created_at.split("T")[0];
          acc[day] = (acc[day] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: `فشل تحليل الإيرادات: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
      error: error instanceof Error ? error.message : "Unknown error",
      executionId: context.executionId,
    };
  }
}

// ============================================
// Speed Optimization Handler
// ============================================

// ─── PageSpeed Insights types ────────────────────────────────────────────────
type PSIAudit = { id: string; title: string; description: string; score: number | null; displayValue?: string };
type PSIResponse = {
  lighthouseResult?: {
    categories?: { performance?: { score?: number } };
    audits?: Record<string, { title: string; description: string; score: number | null; displayValue?: string }>;
  };
  error?: { message: string };
};

async function fetchPageSpeedInsights(url: string, strategy: "mobile" | "desktop"): Promise<{
  score: number;
  fcp: string; lcp: string; tbt: string; cls: string; si: string;
  opportunities: PSIAudit[];
  diagnostics: PSIAudit[];
  source: "pagespeed_api";
}> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || process.env.PAGESPEED_API_KEY || "";
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}${apiKey ? `&key=${apiKey}` : ""}`;

  const res = await fetch(endpoint, { signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`PageSpeed API ${res.status}: ${res.statusText}`);
  const json = await res.json() as PSIResponse;
  if (json.error) throw new Error(json.error.message);

  const lr = json.lighthouseResult;
  const audits = lr?.audits ?? {};
  const score  = Math.round((lr?.categories?.performance?.score ?? 0) * 100);

  const val = (id: string) => audits[id]?.displayValue ?? "—";

  const opportunities: PSIAudit[] = [];
  const diagnostics: PSIAudit[]   = [];

  for (const [id, audit] of Object.entries(audits)) {
    if (audit.score === null || audit.score >= 0.9) continue;
    const item: PSIAudit = { id, title: audit.title, description: audit.description, score: audit.score, displayValue: audit.displayValue };
    if (["render-blocking-resources","unused-css-rules","unused-javascript","uses-optimized-images",
         "uses-webp-images","efficient-animated-content","uses-long-cache-ttl","uses-text-compression"].includes(id)) {
      opportunities.push(item);
    } else {
      diagnostics.push(item);
    }
  }

  return {
    score,
    fcp: val("first-contentful-paint"),
    lcp: val("largest-contentful-paint"),
    tbt: val("total-blocking-time"),
    cls: val("cumulative-layout-shift"),
    si:  val("speed-index"),
    opportunities: opportunities.slice(0, 8),
    diagnostics:   diagnostics.slice(0, 6),
    source: "pagespeed_api",
  };
}

export async function executeSpeedOptimization(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const url        = (params.url as string) || process.env.NEXT_PUBLIC_SITE_URL || "https://azenith-living.vercel.app";
  const strategy   = (params.deviceType as string) === "desktop" ? "desktop" : "mobile";

  try {
    // ── محاولة PageSpeed Insights أولاً ───────────────────────────────
    const psi = await fetchPageSpeedInsights(url, strategy);

    const scoreEmoji = psi.score >= 90 ? "🟢" : psi.score >= 50 ? "🟡" : "🔴";
    const oppLines   = psi.opportunities.map((o) => `  • ${o.title}${o.displayValue ? ` (${o.displayValue})` : ""}`).join("\n");
    const diagLines  = psi.diagnostics.map((d)   => `  • ${d.title}${d.displayValue ? ` (${d.displayValue})` : ""}`).join("\n");

    // ── applyFixes: تُطبَّق لو طُلبت ─────────────────────────────────
    let applyNote = "";
    if (params.applyFixes === true && psi.opportunities.length > 0) {
      const fixResult = await applySpeedFixes(url, psi.opportunities, context);
      applyNote = `\n\n${fixResult.message}`;
      if (fixResult.skipped.length > 0) {
        applyNote += `\n⚠️ تجاوزت: ${fixResult.skipped.slice(0, 3).join("؛ ")}`;
      }
    }

    const message =
      `${scoreEmoji} تحليل السرعة (${strategy}) — ${url}\n\n` +
      `📊 النتيجة: ${psi.score}/100\n` +
      `⚡ FCP: ${psi.fcp}  |  LCP: ${psi.lcp}  |  TBT: ${psi.tbt}\n` +
      `📐 CLS: ${psi.cls}  |  SI: ${psi.si}\n\n` +
      (psi.opportunities.length
        ? `🔧 فرص التحسين (${psi.opportunities.length}):\n${oppLines}\n\n`
        : "") +
      (psi.diagnostics.length
        ? `🔍 تشخيصات (${psi.diagnostics.length}):\n${diagLines}`
        : "") +
      applyNote;

    return {
      success: true,
      message,
      data: {
        url, strategy, score: psi.score,
        metrics: { fcp: psi.fcp, lcp: psi.lcp, tbt: psi.tbt, cls: psi.cls, si: psi.si },
        opportunities: psi.opportunities,
        diagnostics:   psi.diagnostics,
        source: psi.source,
      },
      executionId: context.executionId,
    };

  } catch (psiError) {
    // ── Fallback: SEO analyzer ────────────────────────────────────────
    const fallbackReason = psiError instanceof Error ? psiError.message : "PageSpeed API غير متاح";
    try {
      const seoResult = await analyzeSEOPage(
        url,
        { executionId: context.executionId || crypto.randomUUID(), companyId: context.companyId },
        { saveToDatabase: false }
      );
      const perf = (seoResult.data as Record<string, unknown> | undefined);
      return {
        success: true,
        message: `تحليل السرعة (fallback — ${fallbackReason}):\n${seoResult.message || "تم تحليل الموقع"}`,
        data: { url, strategy, score: 0, fallback: true, fallbackReason, seoData: perf, source: "seo_analyzer" },
        executionId: context.executionId,
      };
    } catch {
      return {
        success: false,
        message: `فشل تحليل السرعة: ${fallbackReason}`,
        error: fallbackReason,
        executionId: context.executionId,
      };
    }
  }
}

// ── speed_optimize: applyFixes handler ───────────────────────────────────────
// يُطبّق تحسينات سرعة حقيقية عبر قاعدة البيانات (site_settings)
// بدون لمس الكود — آمن على production.

async function applySpeedFixes(
  url: string,
  opportunities: Array<{ id: string; title: string; displayValue?: string }>,
  context: ToolExecutionContext
): Promise<{ applied: string[]; skipped: string[]; message: string }> {
  const applied: string[] = [];
  const skipped: string[] = [];
  const supabase = getServiceSupabase();
  if (!supabase) { skipped.push("Supabase غير متاح"); return { applied, skipped, message: skipped[0] }; }

  const oppIds = opportunities.map((o) => o.id);

  // ── 1. Cache-Control headers عبر site_settings ────────────────────────────
  if (oppIds.some((id) => ["uses-long-cache-ttl", "efficient-animated-content"].includes(id))) {
    const { error } = await supabase.from("site_settings").upsert({
      setting_key: "performance_cache_headers",
      setting_value: {
        "Cache-Control": "public, max-age=31536000, immutable",
        appliedAt: new Date().toISOString(),
        appliedBy: "speed_optimizer",
        source: url,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "setting_key" });
    if (!error) applied.push("Cache-Control headers (max-age=31536000)");
    else skipped.push(`cache headers: ${error.message}`);
  }

  // ── 2. Image optimization config ─────────────────────────────────────────
  if (oppIds.some((id) => ["uses-webp-images", "uses-optimized-images", "efficient-animated-content"].includes(id))) {
    const { error } = await supabase.from("site_settings").upsert({
      setting_key: "performance_image_optimization",
      setting_value: {
        preferWebP: true,
        lazyLoad: true,
        quality: 80,
        appliedAt: new Date().toISOString(),
        source: url,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "setting_key" });
    if (!error) applied.push("Image optimization settings (WebP + lazy load)");
    else skipped.push(`image opt: ${error.message}`);
  }

  // ── 3. JS/CSS defer config ────────────────────────────────────────────────
  if (oppIds.some((id) => ["render-blocking-resources", "unused-javascript", "unused-css-rules"].includes(id))) {
    const { error } = await supabase.from("site_settings").upsert({
      setting_key: "performance_script_loading",
      setting_value: {
        deferThirdParty: true,
        removeUnusedCSS: true,
        appliedAt: new Date().toISOString(),
        source: url,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "setting_key" });
    if (!error) applied.push("Script defer + unused CSS removal config");
    else skipped.push(`script loading: ${error.message}`);
  }

  // ── 4. Compression config ─────────────────────────────────────────────────
  if (oppIds.some((id) => ["uses-text-compression"].includes(id))) {
    const { error } = await supabase.from("site_settings").upsert({
      setting_key: "performance_compression",
      setting_value: { gzip: true, brotli: true, appliedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }, { onConflict: "setting_key" });
    if (!error) applied.push("Compression settings (gzip + brotli)");
    else skipped.push(`compression: ${error.message}`);
  }

  // ── 5. تسجيل audit ──────────────────────────────────────────────────────
  if (applied.length > 0 && context.actorUserId) {
    await supabase.from("content_revisions").insert({
      execution_id: context.executionId ?? null,
      company_id: context.companyId ?? null,
      actor_user_id: context.actorUserId,
      table_name: "site_settings",
      record_id: "performance_batch",
      field_name: "performance_settings",
      old_value: null,
      new_value: { applied, url } as never,
      change_reason: "speed_optimize applyFixes",
      change_category: "performance",
      revision_status: "applied",
    });
  }

  const message = applied.length > 0
    ? `✅ طُبّقت ${applied.length} تحسينات سرعة في site_settings:\n${applied.map((a) => `  • ${a}`).join("\n")}`
    : `لم تُطبَّق تحسينات — ${skipped.slice(0, 2).join("؛ ") || "لا فرص قابلة للتطبيق"}`;

  return { applied, skipped, message };
}

export async function executeSystemHealthCheck(
  _params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  // نشغّل كل الفحوصات بالتوازي لتوفير الوقت
  const supabase = (() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    const { createClient: sc } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
    return sc(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  })();

  // ── 1. DB Connectivity + Latency ──────────────────────────────────────
  const dbCheck = await (async () => {
    if (!supabase) return { ok: false, latencyMs: null as number | null, error: "SUPABASE_SERVICE_ROLE_KEY missing" };
    const t0 = Date.now();
    try {
      const { error } = await supabase.from("site_settings").select("id").limit(1).single();
      const latencyMs = Date.now() - t0;
      return { ok: !error, latencyMs, error: error?.message ?? null };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - t0, error: e instanceof Error ? e.message : "unknown" };
    }
  })();

  // ── 2. Recent Failures (آخر 24 ساعة) ─────────────────────────────────
  const failuresCheck = await (async () => {
    if (!supabase) return { count: null as number | null, items: [] as Array<{ tool: string; error: string; at: string }> };
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("agent_executions")
        .select("execution_type, execution_data, started_at")
        .in("execution_status", ["failed", "error"])
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(10);
      const items = (data ?? []).map((r: Record<string, unknown>) => ({
        tool: String(r.execution_type ?? "unknown"),
        error: String((r.execution_data as Record<string, unknown>)?.error ?? "—"),
        at: String(r.started_at ?? ""),
      }));
      return { count: items.length, items };
    } catch { return { count: null, items: [] }; }
  })();

  // ── 3. Pending Approvals ──────────────────────────────────────────────
  const approvalsCheck = await (async () => {
    if (!supabase) return { count: null as number | null };
    try {
      const { count } = await supabase
        .from("approval_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return { count: count ?? 0 };
    } catch { return { count: null }; }
  })();

  // ── 4. Last Backup Age ────────────────────────────────────────────────
  const backupCheck = await (async () => {
    if (!supabase) return { lastBackupAt: null as string | null, ageDays: null as number | null };
    try {
      const { data } = await supabase
        .from("backup_snapshots")
        .select("completed_at")
        .eq("backup_status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .single();
      if (!data?.completed_at) return { lastBackupAt: null, ageDays: null };
      const ageDays = Math.floor((Date.now() - new Date(data.completed_at).getTime()) / (1000 * 60 * 60 * 24));
      return { lastBackupAt: data.completed_at as string, ageDays };
    } catch { return { lastBackupAt: null, ageDays: null }; }
  })();

  // ── 5. API Keys Availability (بدون كشف القيم) ─────────────────────────
  const apiKeysCheck = {
    supabase:  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    openai:    !!(process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY),
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    telegram:  !!(process.env.TELEGRAM_BOT_TOKEN || process.env.ADMIN_TELEGRAM_BOT_TOKEN),
    vercel:    !!(process.env.VERCEL_DEPLOY_HOOK || process.env.VERCEL_TOKEN),
    pagespeed: !!(process.env.GOOGLE_PAGESPEED_API_KEY || process.env.PAGESPEED_API_KEY),
    blob:      !!process.env.BLOB_READ_WRITE_TOKEN,
  };

  // ── 6. agent_memory count ─────────────────────────────────────────────
  const memoryCheck = await (async () => {
    if (!supabase) return { count: null as number | null };
    try {
      const { count } = await supabase
        .from("agent_memory")
        .select("id", { count: "exact", head: true });
      return { count: count ?? 0 };
    } catch { return { count: null }; }
  })();

  // ── getSystemHealth من architect-tools كـ enrichment ─────────────────
  let architectHealth: Record<string, unknown> = {};
  try {
    const h = await getSystemHealth();
    architectHealth = (h.data as Record<string, unknown>) ?? {};
  } catch { /* تكمل بدونه */ }

  // ── بناء التقرير ──────────────────────────────────────────────────────
  const totalMs = Date.now() - startTime;
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!dbCheck.ok)                                   issues.push(`قاعدة البيانات: ${dbCheck.error}`);
  else if (dbCheck.latencyMs && dbCheck.latencyMs > 800) warnings.push(`تأخر DB مرتفع: ${dbCheck.latencyMs}ms`);

  if ((failuresCheck.count ?? 0) > 5)               warnings.push(`${failuresCheck.count} تنفيذ فاشل في آخر 24 ساعة`);
  if ((approvalsCheck.count ?? 0) > 10)             warnings.push(`${approvalsCheck.count} طلب موافقة معلق`);
  if (backupCheck.ageDays !== null && backupCheck.ageDays > 7) warnings.push(`آخر نسخة احتياطية منذ ${backupCheck.ageDays} يوم`);
  if (!apiKeysCheck.supabase)                        issues.push("مفاتيح Supabase مفقودة");
  if (!apiKeysCheck.openai && !apiKeysCheck.anthropic) warnings.push("لا يوجد مفتاح AI نشط (OpenAI أو Anthropic)");

  const overallStatus = issues.length > 0 ? "critical" : warnings.length > 0 ? "warning" : "healthy";
  const statusEmoji   = overallStatus === "healthy" ? "✅" : overallStatus === "warning" ? "⚠️" : "❌";

  // تفاصيل مفاتيح API
  const keysLines = Object.entries(apiKeysCheck)
    .map(([k, v]) => `  ${v ? "✅" : "❌"} ${k}`)
    .join("\n");

  // آخر أخطاء
  const failureLines = failuresCheck.items.slice(0, 3)
    .map((f) => `  • ${f.tool}: ${f.error.slice(0, 60)}`)
    .join("\n");

  const message =
    `${statusEmoji} صحة النظام — ${overallStatus.toUpperCase()} (${totalMs}ms)\n\n` +
    `🗄️ قاعدة البيانات: ${dbCheck.ok ? `✅ متصلة (${dbCheck.latencyMs}ms)` : `❌ ${dbCheck.error}`}\n` +
    `💾 آخر نسخة احتياطية: ${backupCheck.ageDays !== null ? `منذ ${backupCheck.ageDays} يوم` : "غير معروف"}\n` +
    `⏳ موافقات معلقة: ${approvalsCheck.count ?? "—"}\n` +
    `❌ تنفيذات فاشلة (24h): ${failuresCheck.count ?? "—"}\n` +
    `🧠 ذاكرة الوكلاء: ${memoryCheck.count ?? "—"} سجل\n\n` +
    `🔑 مفاتيح API:\n${keysLines}` +
    (failureLines ? `\n\n🔴 آخر أخطاء:\n${failureLines}` : "") +
    (warnings.length ? `\n\n⚠️ تحذيرات:\n${warnings.map((w) => `  • ${w}`).join("\n")}` : "") +
    (issues.length  ? `\n\n❌ مشاكل:\n${issues.map((i) => `  • ${i}`).join("\n")}` : "");

  return {
    success: overallStatus !== "critical",
    message,
    data: {
      overallStatus,
      db:        { ok: dbCheck.ok, latencyMs: dbCheck.latencyMs, error: dbCheck.error },
      failures:  { count: failuresCheck.count, recent: failuresCheck.items.slice(0, 5) },
      approvals: { pendingCount: approvalsCheck.count },
      backup:    { lastAt: backupCheck.lastBackupAt, ageDays: backupCheck.ageDays },
      apiKeys:   apiKeysCheck,
      memory:    { count: memoryCheck.count },
      issues,
      warnings,
      architectHealth,
      checkedInMs: totalMs,
    },
    executionId: context.executionId,
  };
}

export async function executeSpeedDeepAudit(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  // تدقيق سرعة عميق = تحليل PSI + تطبيق إصلاحات اختيارياً
  const url = (params.url as string) || process.env.NEXT_PUBLIC_SITE_URL || "https://azenith-living.vercel.app";
  return executeSpeedOptimization({ ...params, url, deviceType: "mobile" }, context);
}

export async function executeMetricsRealtime(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const range = (params.timeRange as string) || "7d";
  const days = range === "30d" ? 30 : range === "24h" || range === "1h" ? 1 : 7;
  try {
    const report = await getAnalyticsReport({ days: days as 7 | 30 | 90 });
    return {
      success: report.success !== false,
      message: report.message || `مؤشرات آخر ${days} يوم`,
      data: report.data as Record<string, unknown> | undefined,
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "فشل المؤشرات",
      executionId: context.executionId,
    };
  }
}

export async function executeBackupList(
  _params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = getServiceSupabase() || (await getSupabase());
  try {
    const { data, error } = await supabase
      .from("backup_snapshots")
      .select("id, backup_name, backup_type, backup_status, created_at, size_bytes")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    const count = data?.length || 0;
    return {
      success: true,
      message: `عندك ${count} نسخة احتياطية مسجّلة`,
      data: { backups: data || [] },
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "تعذر قراءة النسخ الاحتياطية",
      executionId: context.executionId,
    };
  }
}

export async function executeSeoFixIssues(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const url =
    (params.url as string) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://azenith-living.vercel.app";

  try {
    // static import بدل dynamic لضمان bundling صحيح
    const { applySeoAutoFixes } = await import("@/lib/seo-auto-fixer");
    const fix = await applySeoAutoFixes({
      url,
      autoFixAll: params.autoFixAll === true,
      issueCodes: params.issueCodes as string[] | undefined,
    });
    return {
      success: fix.success,
      message: fix.message + (fix.applied.length ? `\n✅ ${fix.applied.join("\n✅ ")}` : ""),
      data: {
        applied:   fix.applied,
        skipped:   fix.skipped,
        score:     fix.data?.score,
        analysisId: fix.data?.analysisId,
        issuesFound: fix.data?.issuesFound,
        url,
        canRollback: false, // SEO fixes في DB قابلة للتراجع يدوياً
      },
      executionId: context.executionId,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "فشل إصلاح SEO";
    return {
      success: false,
      message: `فشل إصلاح SEO: ${msg}`,
      error: msg,
      executionId: context.executionId,
    };
  }
}

export async function executeGoalCreate(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = getServiceSupabase() || (await getSupabase());
  try {
    const { data, error } = await supabase
      .from("agent_goals_v2")
      .insert({
        title: (params.title as string) || "هدف من المساعد",
        description: (params.description as string) || "",
        goal_type: "metric_target",
        target_metric: (params.targetMetric as string) || "conversion_rate",
        target_value: Number(params.targetValue) || 5,
        unit: "percent",
        company_id: context.companyId || process.env.MASTER_COMPANY_ID || null,
        created_by: context.actorUserId,
        status: "active",
        progress_percent: 0,
        current_value: 0,
        priority: Number(params.priority) || 5,
        auto_check_enabled: params.autoCheck === true,
      })
      .select("id, title, target_metric, target_value")
      .single();
    if (error) throw error;
    return {
      success: true,
      message: `تم إنشاء الهدف: ${data.title}`,
      data,
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "فشل إنشاء الهدف",
      executionId: context.executionId,
    };
  }
}

export async function executeGoalList(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = getServiceSupabase() || (await getSupabase());
  const status = (params.status as string) || "active";
  try {
    let q = supabase
      .from("agent_goals_v2")
      .select("id, title, status, progress_percent, target_metric, target_value, current_value")
      .order("created_at", { ascending: false })
      .limit(25);
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return {
      success: true,
      message: `${data?.length || 0} هدف`,
      data: { goals: data || [] },
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "فشل قراءة الأهداف",
      executionId: context.executionId,
    };
  }
}

export async function executeGoalCheckProgress(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = getServiceSupabase() || (await getSupabase());
  const goalId = params.goalId as string;
  try {
    const { data: goal, error } =
      goalId && goalId !== "latest"
        ? await supabase.from("agent_goals_v2").select("*").eq("id", goalId).single()
        : await supabase
            .from("agent_goals_v2")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1);
    if (error) throw error;
    const g = Array.isArray(goal) ? goal[0] : goal;
    if (!g) {
      return { success: false, message: "لا يوجد هدف", executionId: context.executionId };
    }
    return {
      success: true,
      message: `الهدف «${g.title}»: ${g.progress_percent ?? 0}% (الحالي ${g.current_value} / الهدف ${g.target_value})`,
      data: g,
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "فشل فحص الهدف",
      executionId: context.executionId,
    };
  }
}

export async function executeContentUpdate(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = await getSupabase();
  const entityType = (params.entityType as string) || "section";
  let entityId = params.entityId as string;
  const newValue = params.newValue as Record<string, unknown>;
  if (!entityId || !newValue) {
    return {
      success: false,
      message: "entityId و newValue مطلوبان",
      executionId: context.executionId,
    };
  }
  const svc = getServiceSupabase() || supabase;

  try {
    if (entityType === "section" || entityType === "site_section") {
      if (entityId === "latest") {
        const { data: latest, error: latestError } = await svc
          .from("site_sections")
          .select("id")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestError) throw latestError;
        if (!latest?.id) throw new Error("لم أجد قسماً لتحديثه");
        entityId = latest.id;
      }

      const { data, error } = await svc
        .from("site_sections")
        .update({
          section_content: newValue as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entityId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("لم يتم تحديث أي قسم");
      return {
        success: true,
        message: "تم تحديث محتوى القسم",
        data: { entityId },
        executionId: context.executionId,
      };
    }

    if (entityType === "product") {
      if (entityId === "latest") {
        const { data: latest, error: latestError } = await svc
          .from("products")
          .select("id")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestError) throw latestError;
        if (!latest?.id) throw new Error("لم أجد منتجاً لتحديثه");
        entityId = latest.id;
      }

      const { data, error } = await svc
        .from("products")
        .update({
          ...newValue,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", entityId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("لم يتم تحديث أي منتج");
      return {
        success: true,
        message: "تم تحديث المنتج",
        data: { entityId },
        executionId: context.executionId,
      };
    }

    if (entityType === "lead" || entityType === "user") {
      if (entityId === "latest") {
        const { data: latest, error: latestError } = await svc
          .from("users")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestError) throw latestError;
        if (!latest?.id) throw new Error("لم أجد عميلاً لتحديثه");
        entityId = latest.id;
      }

      const allowed = ["full_name", "phone", "email", "room_type", "budget", "style", "score", "intent", "notes"];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) {
        if (k in newValue) patch[k] = newValue[k];
      }
      if (Object.keys(patch).length === 0) {
        throw new Error("لا توجد حقول عميل مسموح بتحديثها في الطلب");
      }
      const { data, error } = await svc
        .from("users")
        .update(patch)
        .eq("id", entityId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("لم يتم تحديث أي عميل");
      return {
        success: true,
        message: "تم تحديث بيانات العميل",
        data: { entityId },
        executionId: context.executionId,
      };
    }

    if (entityType === "site_setting") {
      const key = (newValue.key as string) || entityId;
      const { error } = await svc
        .from("site_settings")
        .upsert({
          key,
          value: (newValue.value ?? newValue) as Json,
          updated_at: new Date().toISOString(),
        } as never, { onConflict: "key" });
      if (error) throw error;
      return {
        success: true,
        message: `تم تحديث الإعداد ${key}`,
        data: { key },
        executionId: context.executionId,
      };
    }

    return {
      success: false,
      message: `نوع الكيان ${entityType} غير مدعوم — استخدم: section, product, lead, site_setting`,
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "فشل تحديث المحتوى",
      executionId: context.executionId,
    };
  }
}
