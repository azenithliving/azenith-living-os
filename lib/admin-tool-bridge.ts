/**
 * Server-side Ultimate tools + Genesis for the unified assistant.
 */

import { executeTool } from "@/lib/agent-tools/tool-registry";
import { SovereignArchitect } from "@/lib/sovereign-architect";

export interface AdminToolContext {
  userId: string;
  userEmail?: string;
  companyId?: string;
}

export async function runUltimateTool(
  toolName: string,
  params: Record<string, unknown>,
  ctx: AdminToolContext
) {
  return executeTool(toolName, params, {
    actorUserId: ctx.userId,
    companyId: ctx.companyId || process.env.MASTER_COMPANY_ID || undefined,
    executionId: crypto.randomUUID(),
  });
}

export async function runGenesisManifest(intent: string) {
  const architect = SovereignArchitect.getInstance();
  return architect.manifest(intent);
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://azenith-living-os.vercel.app"
  );
}

export function inferUltimateTool(
  message: string
): { toolName: string; params: Record<string, unknown> } | null {
  const lower = message.toLowerCase();
  const url = siteUrl();

  if (/صلح.*seo|fix.*seo|seo_fix|مشاكل.*seo/i.test(lower)) {
    return { toolName: "seo_fix_issues", params: { url } };
  }
  if (/seo|تحسين.*بحث|محركات|meta\s*tags/i.test(lower)) {
    return { toolName: "seo_analyze", params: { url } };
  }
  if (
    /نسخ.*احتياط|backup(?!_db)|احتياطي/i.test(lower) &&
    !/قاعدة|\bdb\b/i.test(lower) &&
    /إعداد|settings|جداول|tables/i.test(lower)
  ) {
    return { toolName: "backup_create", params: { tables: ["site_settings"] } };
  }
  if (/نسخ.*احتياط|backup(?!_db)|احتياطي/i.test(lower) && !/قاعدة|\bdb\b/i.test(lower)) {
    return { toolName: "backup_create", params: { tables: ["site_settings"] } };
  }
  if (/استرجع|restore.*backup/i.test(lower)) {
    const idMatch = lower.match(/backup[_-]?(\w+)/);
    return {
      toolName: "backup_restore",
      params: { backupId: idMatch?.[1] || "latest" },
    };
  }
  if (/قائمة.*نسخ|list.*backup/i.test(lower)) {
    return { toolName: "backup_list", params: {} };
  }
  if (/أنشئ.*قسم|انشئ.*قسم|create.*section|قسم جديد/i.test(lower)) {
    return {
      toolName: "section_create",
      params: {
        title: "قسم جديد",
        slug: `section-${Date.now()}`,
        pageSlug: "home",
        placement: "main",
      },
    };
  }
  if (/حدّ?ث.*قسم|update.*section/i.test(lower)) {
    return {
      toolName: "section_update",
      params: { sectionId: "latest", title: message.slice(0, 80) },
    };
  }
  if (/احذف.*قسم|delete.*section/i.test(lower)) {
    return { toolName: "section_delete", params: { sectionId: "latest" } };
  }
  if (/حدّ?ث.*محتوى|content_update|نص.*الصفحة/i.test(lower)) {
    return {
      toolName: "content_update",
      params: { entityType: "section", entityId: "home", newValue: { body: message } },
    };
  }
  if (/سرعة|performance|core web|lcp|سرعة.*الموقع/i.test(lower)) {
    if (/حسّ?ن|optimize|تحسين/i.test(lower)) {
      return { toolName: "speed_optimize", params: { url } };
    }
    return { toolName: "speed_analyze", params: { url } };
  }
  if (/إيراد|revenue|مبيعات.*تحليل|ربح/i.test(lower)) {
    return { toolName: "revenue_analyze", params: { days: 30 } };
  }
  if (/مؤشرات.*لحظ|realtime|metrics.*live/i.test(lower)) {
    return { toolName: "metrics_realtime", params: {} };
  }
  if (/هدف|goal|okr|أهداف/i.test(lower)) {
    if (/قائمة|list|اعرض|وريني/i.test(lower)) {
      return { toolName: "goal_list", params: {} };
    }
    if (/تقدم|progress/i.test(lower)) {
      return { toolName: "goal_check_progress", params: { goalId: "latest" } };
    }
    return {
      toolName: "goal_create",
      params: {
        title: "هدف من الأدمن",
        targetMetric: "conversion_rate",
        targetValue: 5,
      },
    };
  }
  if (/إعداد|setting|config/i.test(lower) && /حدّ?ث|غيّر|update/i.test(lower)) {
    return {
      toolName: "setting_update",
      params: { key: "general", value: { note: message.slice(0, 200) } },
    };
  }
  if (/system_health|فحص.*تقني.*عميق/i.test(lower)) {
    return { toolName: "system_health_check", params: {} };
  }

  return null;
}

export function wantsGenesis(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /genesis|تكوين|كوّن|كون|manifest|أنشئ.*(موقع|نظام)|ابنِ.*موقع|ابني.*موقع/i.test(
      lower
    ) && !/قسم واحد|section_create|قسم جديد|واتساب|حملة/i.test(lower)
  );
}
