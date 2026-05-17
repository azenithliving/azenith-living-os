/**
 * Extended admin tool handlers — architect, CRM, research, content health.
 */

import { createClient } from "@supabase/supabase-js";
import {
  checkContentHealthWithInput,
  addProduct,
  listProducts,
  webSearch,
  readWebsite,
  analyzeRevenueOpportunitiesWithInput,
  optimizeSpeedWithInput,
} from "@/lib/architect-tools";
import { buildLeadDossier, sendWhatsAppDossier } from "@/lib/whatsapp-dossier";
import { resolveAdminWhatsAppPhone } from "@/lib/admin-whatsapp-resolver";
import { executeTool as executeRealTool } from "@/lib/real-tool-executor";
import { triggerVercelDeploy } from "@/lib/admin-cloud-evolution";
import type { ToolExecutionContext, ToolExecutionResult } from "@/lib/agent-tools/tool-registry";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function architectToTool(result: {
  success?: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}): ToolExecutionResult {
  return {
    success: result.success !== false,
    message: result.message || result.error || "تم",
    data: result.data as Record<string, unknown> | undefined,
    error: result.error,
  };
}

const SAFE_RESTORE_TABLES = new Set([
  "site_settings",
  "site_sections",
  "automation_rules",
  "general_suggestions",
]);

const STANDARD_RESTORE_TABLES = new Set([
  ...SAFE_RESTORE_TABLES,
  "products",
  "agent_goals_v2",
  "agent_memory",
]);

const ALWAYS_BLOCKED_RESTORE = new Set(["immutable_command_log", "approval_requests"]);

const USERS_MERGE_TABLES = new Set(["users", "requests"]);

export async function executeBackupRestore(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return { success: false, message: "قاعدة البيانات غير متاحة", executionId: context.executionId };
  }

  const confirmRestore = params.confirmRestore === true;
  const confirmFullRestore = params.confirmFullRestore === true;
  const confirmUsersRestore = params.confirmUsersRestore === true;
  const restoreTier = (params.restoreTier as string) || (confirmFullRestore ? "full" : "standard");
  const backupId = (params.backupId as string) || "latest";

  if (confirmUsersRestore && !confirmRestore) {
    return {
      success: false,
      message: "استعادة العملاء تتطلب confirmRestore:true معاً",
      executionId: context.executionId,
    };
  }

  try {
    const { data: snapshot, error: snapErr } =
      backupId === "latest"
        ? await supabase
            .from("backup_snapshots")
            .select("*")
            .eq("backup_status", "completed")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : await supabase.from("backup_snapshots").select("*").eq("id", backupId).single();

    if (snapErr || !snapshot) {
      return {
        success: false,
        message: "لم أجد نسخة احتياطية للاستعادة",
        executionId: context.executionId,
      };
    }

    const res = await fetch(snapshot.storage_url);
    if (!res.ok) throw new Error(`تعذر تحميل النسخة: ${res.status}`);
    const backup = (await res.json()) as {
      metadata?: { tables?: string[] };
      data?: Record<string, unknown[]>;
    };

    const tables =
      backup.metadata?.tables || Object.keys(backup.data || {}).filter((t) => t !== "metadata");
    const plan: Array<{ table: string; rows: number; action: string }> = [];

    for (const table of tables) {
      const rows = backup.data?.[table];
      const count = Array.isArray(rows) ? rows.length : 0;
      if (!count) {
        plan.push({ table, rows: 0, action: "skip_empty" });
        continue;
      }
      if (ALWAYS_BLOCKED_RESTORE.has(table)) {
        plan.push({ table, rows: count, action: "blocked_system" });
        continue;
      }

      const isUsersTable = USERS_MERGE_TABLES.has(table);
      if (isUsersTable && !confirmUsersRestore) {
        plan.push({ table, rows: count, action: "needs_confirmUsersRestore" });
        continue;
      }

      const allowed =
        restoreTier === "full" || isUsersTable
          ? isUsersTable
            ? confirmUsersRestore
            : true
          : restoreTier === "safe"
            ? SAFE_RESTORE_TABLES.has(table)
            : STANDARD_RESTORE_TABLES.has(table);

      if (!allowed) {
        plan.push({ table, rows: count, action: "skipped_policy" });
        continue;
      }
      if (!confirmRestore) {
        plan.push({
          table,
          rows: count,
          action: isUsersTable ? "would_merge_users" : "would_upsert",
        });
        continue;
      }

      const preCount = isUsersTable
        ? await supabase.from(table).select("id", { count: "exact", head: true })
        : null;

      const { error: upsertErr } = await supabase
        .from(table)
        .upsert(rows as never[], { onConflict: "id", ignoreDuplicates: false });
      plan.push({
        table,
        rows: count,
        action: upsertErr
          ? `error:${upsertErr.message}`
          : isUsersTable
            ? `merged_users (pre:${preCount?.count ?? "?"})`
            : "restored",
      });
    }

    if (confirmRestore) {
      await supabase
        .from("backup_snapshots")
        .update({
          restored_at: new Date().toISOString(),
          restored_by: context.actorUserId || null,
          restoration_result: {
            plan,
            usersRestore: confirmUsersRestore,
            mergeOnly: true,
            noDeletes: true,
          } as never,
          backup_status: "restored",
        })
        .eq("id", snapshot.id);
    }

    const restored = plan.filter((p) => p.action === "restored").length;
    return {
      success: true,
      message: confirmRestore
        ? `تمت الاستعادة من «${snapshot.backup_name}» (${restoreTier}${confirmUsersRestore ? " + عملاء merge" : ""}): ${restored} جدول — بدون حذف`
        : `معاينة «${snapshot.backup_name}» [${restoreTier}] — confirmRestore:true${confirmUsersRestore ? " + confirmUsersRestore:true للعملاء" : ""}`,
      data: {
        backupId: snapshot.id,
        plan,
        dryRun: !confirmRestore,
        restoreTier,
        confirmUsersRestore,
      },
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "فشل الاستعادة",
      executionId: context.executionId,
    };
  }
}

export async function executeContentHealthCheck(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://azenith-living-os.vercel.app";
  const slug = (params.pageSlug as string) || "home";
  const url = slug === "home" ? base : `${base.replace(/\/$/, "")}/${slug}`;
  const r = await checkContentHealthWithInput({
    url,
    maxPages: Number(params.maxPages) || 4,
  });
  return { ...architectToTool(r), executionId: context.executionId };
}

export async function executeProductAdd(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const r = await addProduct({
    name: (params.name as string) || "منتج جديد",
    price: Number(params.price) || 0,
    description: (params.description as string) || "",
    category: (params.category as string) || undefined,
  });
  return { ...architectToTool(r), executionId: context.executionId };
}

export async function executeProductList(
  _params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const r = await listProducts();
  return { ...architectToTool(r), executionId: context.executionId };
}

export async function executeWebSearch(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const r = await webSearch({
    query: (params.query as string) || "",
  });
  return { ...architectToTool(r), executionId: context.executionId };
}

export async function executeReadWebsite(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const r = await readWebsite({ url: (params.url as string) || "" });
  return { ...architectToTool(r), executionId: context.executionId };
}

export async function executeRevenueOpportunities(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const days = Number(params.days) || 30;
  const r = await analyzeRevenueOpportunitiesWithInput({
    days: (days === 7 || days === 90 ? days : 30) as 7 | 30 | 90,
  });
  return { ...architectToTool(r), executionId: context.executionId };
}

export async function executeSpeedDeepAudit(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const url =
    (params.url as string) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://azenith-living-os.vercel.app";
  const r = await optimizeSpeedWithInput({
    url,
    strategy: params.deviceType === "desktop" ? "desktop" : "mobile",
  });
  return { ...architectToTool(r), executionId: context.executionId };
}

export async function executeLeadList(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return { success: false, message: "قاعدة البيانات غير متاحة", executionId: context.executionId };
  }
  const limit = Math.min(Number(params.limit) || 20, 50);
  const intent = params.intent as string | undefined;
  try {
    let q = supabase
      .from("users")
      .select("id, full_name, phone, email, intent, score, room_type, budget, style, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (intent && intent !== "all") q = q.eq("intent", intent);
    const companyId = context.companyId || process.env.MASTER_COMPANY_ID;
    if (companyId) q = q.eq("company_id", companyId);
    const { data, error } = await q;
    if (error) throw error;
    return {
      success: true,
      message: `${data?.length || 0} عميل/lead`,
      data: { leads: data || [] },
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "فشل قراءة العملاء",
      executionId: context.executionId,
    };
  }
}

export async function executeLeadDossierSend(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const leadId = params.leadId as string;
  const tenantId =
    (params.tenantId as string) ||
    context.companyId ||
    process.env.MASTER_COMPANY_ID ||
    "";
  if (!leadId) {
    return { success: false, message: "leadId مطلوب", executionId: context.executionId };
  }

  const { phone: adminPhone, source } = await resolveAdminWhatsAppPhone({
    override: params.adminPhone as string | undefined,
    tenantId,
    companyId: tenantId,
  });

  if (!tenantId || !adminPhone) {
    return {
      success: false,
      message:
        "لم أجد رقم واتساب — أضفه في إعدادات الشركة أو WHATSAPP_DEFAULT_NUMBER",
      executionId: context.executionId,
    };
  }

  try {
    const dossier = await buildLeadDossier(leadId, tenantId);
    if (!dossier) {
      return { success: false, message: "لم أجد الـ lead", executionId: context.executionId };
    }
    const sent = await sendWhatsAppDossier(dossier, adminPhone, tenantId);
    return {
      success: sent.success,
      message: sent.success
        ? `تم إرسال ملف العميل ${dossier.fullName} على واتساب (${source})`
        : sent.error || "فشل الإرسال",
      data: { leadId, tier: dossier.qualification.tier, phoneSource: source },
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "فشل dossier",
      executionId: context.executionId,
    };
  }
}

export async function executeRoomUpdate(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return { success: false, message: "قاعدة البيانات غير متاحة", executionId: context.executionId };
  }
  const userId = (params.userId as string) || (params.leadId as string);
  if (!userId) {
    return { success: false, message: "userId أو leadId مطلوب", executionId: context.executionId };
  }
  const patch: Record<string, unknown> = {};
  if (params.roomType) patch.room_type = params.roomType;
  if (params.budget) patch.budget = params.budget;
  if (params.style) patch.style = params.style;
  if (params.score !== undefined) patch.score = Number(params.score);
  if (params.intent) patch.intent = params.intent;

  try {
    const { data, error } = await supabase
      .from("users")
      .update(patch)
      .eq("id", userId)
      .select("id, full_name, room_type, budget, style, score, intent")
      .single();
    if (error) throw error;
    return {
      success: true,
      message: `تم تحديث بيانات ${data.full_name || userId}`,
      data,
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "فشل تحديث الغرفة/العميل",
      executionId: context.executionId,
    };
  }
}

function realToolToResult(
  r: { success: boolean; message: string; data?: unknown; error?: string },
  executionId?: string
): ToolExecutionResult {
  return {
    success: r.success,
    message: r.message,
    data: r.data as Record<string, unknown> | undefined,
    error: r.error,
    executionId,
  };
}

function toRealContext(context: ToolExecutionContext) {
  return {
    ...context,
    executionId: context.executionId || crypto.randomUUID(),
  };
}

export async function executeInventoryCheckLow(
  _params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const r = await executeRealTool("inventory_check_low", {}, toRealContext(context), {
    autoApprove: true,
  });
  return realToolToResult(r, context.executionId);
}

export async function executeInventoryUpdateTool(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const r = await executeRealTool("inventory_update", params, toRealContext(context), {
    autoApprove: params.autoApprove === true,
  });
  return realToolToResult(r, context.executionId);
}

export async function executeManufacturingInventory(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return { success: false, message: "قاعدة البيانات غير متاحة", executionId: context.executionId };
  }
  const companyId =
    (params.companyId as string) || context.companyId || process.env.MASTER_COMPANY_ID;
  if (!companyId) {
    return { success: false, message: "companyId مطلوب", executionId: context.executionId };
  }

  try {
    let q = supabase
      .from("inventory_items")
      .select("id, name, sku, current_quantity, min_stock_level, category")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name")
      .limit(40);
    const { data, error } = await q;
    if (error) throw error;
    let items = data || [];
    if (params.lowStockOnly === true) {
      items = items.filter(
        (i: { current_quantity?: number; min_stock_level?: number }) =>
          (i.current_quantity ?? 0) <= (i.min_stock_level ?? 0)
      );
    }
    const low = items.filter(
      (i: { current_quantity?: number; min_stock_level?: number }) =>
        (i.current_quantity ?? 0) <= (i.min_stock_level ?? 0)
    );
    return {
      success: true,
      message: `${items.length} صنف مخزون — ${low.length} منخفض`,
      data: { items, lowStock: low },
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "فشل مخزون التصنيع",
      executionId: context.executionId,
    };
  }
}

export async function executeManufacturingStockAdjust(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return { success: false, message: "قاعدة البيانات غير متاحة", executionId: context.executionId };
  }
  const itemId = params.inventoryItemId as string;
  const quantity = Number(params.quantity);
  const action = (params.action as string) || "stock_in";
  if (!itemId || !quantity) {
    return {
      success: false,
      message: "inventoryItemId و quantity مطلوبان",
      executionId: context.executionId,
    };
  }
  try {
    const { data: item } = await supabase
      .from("inventory_items")
      .select("current_quantity, name")
      .eq("id", itemId)
      .single();
    if (!item) throw new Error("صنف غير موجود");
    const delta = action === "stock_out" ? -quantity : quantity;
    const newQty = (item.current_quantity || 0) + delta;
    if (newQty < 0) throw new Error("كمية غير كافية");
    const { error } = await supabase
      .from("inventory_items")
      .update({ current_quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", itemId);
    if (error) throw error;
    await supabase.from("inventory_movements").insert({
      inventory_item_id: itemId,
      movement_type: action === "stock_out" ? "out" : "in",
      quantity: Math.abs(quantity),
      notes: (params.notes as string) || "من المساعد",
      created_by: context.actorUserId || null,
    } as never);
    return {
      success: true,
      message: `مخزون «${item.name}»: ${item.current_quantity} → ${newQty}`,
      data: { itemId, newQty },
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "فشل تعديل المخزون",
      executionId: context.executionId,
    };
  }
}

export async function executeManufacturingOrders(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return { success: false, message: "قاعدة البيانات غير متاحة", executionId: context.executionId };
  }
  const companyId =
    (params.companyId as string) || context.companyId || process.env.MASTER_COMPANY_ID;
  try {
    let q = supabase
      .from("sales_orders")
      .select("id, order_number, status, total_amount, created_at")
      .eq("company_id", companyId || "")
      .order("created_at", { ascending: false })
      .limit(20);
    const status = params.status as string;
    if (status && status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return {
      success: true,
      message: `${data?.length || 0} أمر تصنيع/بيع`,
      data: { orders: data || [] },
      executionId: context.executionId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "تعذر قراءة أوامر التصنيع",
      executionId: context.executionId,
    };
  }
}

export async function executeDeployTrigger(
  _params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const r = await triggerVercelDeploy();
  return { ...r, executionId: context.executionId };
}

export async function executeProjectEvolve(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const mission =
    (params.mission as string) ||
    (params.description as string) ||
    "تحسين المشروع من تحليل الأخطاء";
  const { executeProjectEvolutionMission } = await import("@/lib/admin-project-evolver");
  const r = await executeProjectEvolutionMission(mission, {
    userId: context.actorUserId,
  });
  return {
    success: r.success,
    message: r.message,
    data: r.data as Record<string, unknown> | undefined,
    executionId: context.executionId,
  };
}
