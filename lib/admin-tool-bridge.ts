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

  if (/تذكّ?ر|remember/i.test(lower)) return null;

  if (/صلح.*seo|fix.*seo|seo_fix|مشاكل.*seo|أصلح.*seo/i.test(lower)) {
    return { toolName: "seo_fix_issues", params: { url, autoFixAll: true } };
  }
  if (/seo|تحسين.*بحث|محركات|meta\s*tags/i.test(lower) && !/fix|صلح/i.test(lower)) {
    return { toolName: "seo_analyze", params: { url } };
  }

  if (/صحة.*محتوى|content\s*health|فحص.*محتوى/i.test(lower)) {
    const slug = /about|من نحن/i.test(lower) ? "about" : /contact|تواصل/i.test(lower) ? "contact" : "home";
    return { toolName: "content_health_check", params: { pageSlug: slug } };
  }

  if (/استرجع|restore.*backup|ارجع.*نسخة/i.test(lower)) {
    const idMatch = message.match(/\b[0-9a-f-]{36}\b/i);
    return {
      toolName: "backup_restore",
      params: {
        backupId: idMatch?.[0] || "latest",
        confirmRestore: /confirm|أكّ?د|نفّ?ذ.*استعادة/i.test(lower),
      },
    };
  }
  if (/list.*backup|backup.*list|قائمة.*نسخ|اعرض.*نسخ/i.test(lower)) {
    return { toolName: "backup_list", params: {} };
  }
  if (
    /نسخ.*احتياط|backup(?!_db)/i.test(lower) &&
    !/قاعدة|\bdb\b|list|قائمة|استرجع|restore/i.test(lower)
  ) {
    return { toolName: "backup_create", params: { tables: ["site_settings", "site_sections"] } };
  }

  if (/أضف.*منتج|add.*product|منتج جديد/i.test(lower)) {
    const priceMatch = lower.match(/(\d{2,7})/);
    return {
      toolName: "product_add",
      params: {
        name: message.replace(/أضف|منتج|add|product/gi, "").trim().slice(0, 80) || "منتج جديد",
        price: priceMatch ? Number(priceMatch[1]) : 0,
      },
    };
  }
  if (/اعرض.*منتج|list.*product|المنتجات/i.test(lower)) {
    return { toolName: "product_list", params: {} };
  }

  if (/ابحث.*عن|web\s*search|بحث.*ويب/i.test(lower)) {
    const q = message.replace(/ابحث.*عن|web\s*search|بحث.*ويب/gi, "").trim();
    return { toolName: "web_search", params: { query: q || message } };
  }
  if (/اقرأ.*موقع|read.*website|محتوى.*رابط/i.test(lower)) {
    const urlMatch = message.match(/https?:\/\/\S+/i);
    return { toolName: "read_website", params: { url: urlMatch?.[0] || url } };
  }

  if (/فرص.*إيراد|revenue.*opportunit/i.test(lower)) {
    return { toolName: "revenue_opportunities", params: { days: 30 } };
  }
  if (/تدقيق.*سرعة.*عميق|deep.*speed|speed.*deep/i.test(lower)) {
    return { toolName: "speed_deep_audit", params: { url } };
  }

  if (/اعرض.*(عملاء|leads|زبائن)|قائمة.*عملاء|list.*leads/i.test(lower)) {
    const intent = /buyer|مشتري/i.test(lower)
      ? "buyer"
      : /interested|مهتم/i.test(lower)
        ? "interested"
        : "all";
    return { toolName: "lead_list", params: { limit: 20, intent } };
  }
  if (/ملف.*عميل|dossier|ابعت.*واتساب.*عميل/i.test(lower)) {
    const idMatch = message.match(/\b[0-9a-f-]{36}\b/i);
    return { toolName: "lead_dossier_send", params: { leadId: idMatch?.[0] || "" } };
  }
  if (/حدّ?ث.*(غرفة|سعر|ميزانية|lead)|update.*room/i.test(lower)) {
    const idMatch = message.match(/\b[0-9a-f-]{36}\b/i);
    return {
      toolName: "room_update",
      params: {
        userId: idMatch?.[0],
        budget: /ميزانية|budget/i.test(lower) ? message.slice(0, 120) : undefined,
        roomType: /غرفة|room/i.test(lower) ? message.slice(0, 80) : undefined,
      },
    };
  }

  if (/أنشئ.*قسم|انشئ.*قسم|create.*section|قسم جديد/i.test(lower)) {
    return {
      toolName: "section_create",
      params: {
        name: "قسم جديد",
        type: "content",
        pagePlacement: "home",
      },
    };
  }
  if (/حدّ?ث.*قسم|update.*section/i.test(lower)) {
    return { toolName: "section_update", params: { sectionId: "latest", name: message.slice(0, 80) } };
  }
  if (/احذف.*قسم|delete.*section/i.test(lower)) {
    return { toolName: "section_delete", params: { sectionId: "latest" } };
  }
  if (/حدّ?ث.*محتوى|content_update|نص.*صفحة|حدّ?ث.*منتج/i.test(lower)) {
    const entityType = /منتج|product/i.test(lower)
      ? "product"
      : /عميل|lead|user/i.test(lower)
        ? "lead"
        : "section";
    const idMatch = message.match(/\b[0-9a-f-]{36}\b/i);
    return {
      toolName: "content_update",
      params: {
        entityType,
        entityId: idMatch?.[0] || "latest",
        newValue: { body: message, note: message.slice(0, 300) },
      },
    };
  }

  if (/سرعة|performance|core web|lcp/i.test(lower)) {
    if (/حسّ?ن|optimize|تحسين/i.test(lower)) {
      return { toolName: "speed_optimize", params: { url } };
    }
    return { toolName: "speed_analyze", params: { url } };
  }
  if (/إيراد|revenue|مبيعات.*تحليل/i.test(lower) && !/فرص/i.test(lower)) {
    return { toolName: "revenue_analyze", params: { days: 30 } };
  }
  if (/مؤشرات.*لحظ|realtime|metrics.*live|المؤشرات.*الآن/i.test(lower)) {
    return { toolName: "metrics_realtime", params: { timeRange: "24h" } };
  }
  if (/هدف|goal|okr|أهداف/i.test(lower)) {
    if (/قائمة|list|اعرض|وريني/i.test(lower)) {
      return { toolName: "goal_list", params: {} };
    }
    if (/تقدم|progress|وين.*الهدف/i.test(lower)) {
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
  if (/إعداد|setting/i.test(lower) && /حدّ?ث|غيّر|update/i.test(lower)) {
    return {
      toolName: "setting_update",
      params: { key: "general", value: { note: message.slice(0, 200) } },
    };
  }
  if (/system_health|فحص.*تقني.*عميق/i.test(lower)) {
    return { toolName: "system_health_check", params: {} };
  }

  if (/مخزون.*منخفض|low\s*stock|نفاد.*مخزون/i.test(lower)) {
    if (/تصنيع|مصنع|mfg|inventory_items/i.test(lower)) {
      return { toolName: "mfg_inventory_list", params: { lowStockOnly: true } };
    }
    return { toolName: "inventory_check_low", params: {} };
  }
  if (/مخزون.*تصنيع|مصنع.*مخزون|mfg.*inventory/i.test(lower)) {
    return { toolName: "mfg_inventory_list", params: {} };
  }
  if (/أوامر.*(تصنيع|بيع)|manufacturing\s*orders|production\s*orders/i.test(lower)) {
    return { toolName: "mfg_orders_list", params: { status: "pending" } };
  }
  if (/انشر.*(الموقع|vercel)|deploy.*(site|vercel)/i.test(lower)) {
    return { toolName: "deploy_trigger", params: {} };
  }
  if (/طوّ?ر.*(المشروع|الكود)|project\s*evolve|أصلح.*الكود/i.test(lower)) {
    return { toolName: "project_evolve", params: { mission: message } };
  }
  if (/زود.*مخزون|inventory\s*update|عدّل.*مخزون/i.test(lower)) {
    return {
      toolName: "inventory_update",
      params: {
        productId: (message.match(/\b[0-9a-f-]{36}\b/i) || [])[0] || "",
        quantityChange: Number((lower.match(/(\d+)/) || [])[1]) || 1,
      },
    };
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
