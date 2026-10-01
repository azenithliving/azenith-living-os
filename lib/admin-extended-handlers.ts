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
import { buildLeadDossier, sendTelegramDossier } from "@/lib/lead-dossier";
import { executeTool as executeRealTool } from "@/lib/real-tool-executor";
import { triggerVercelDeploy } from "@/lib/admin-cloud-evolution";
import { runBrowserResearchMission } from "@/lib/admin-browser-copilot-brain";
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

async function loadBackupJson(snapshot: {
  storage_url?: string | null;
  storage_provider?: string | null;
  checksum?: string | null;
}) {
  const storageUrl = snapshot.storage_url || "";
  if (!storageUrl) throw new Error("النسخة الاحتياطية لا تحتوي على مسار تخزين");

  let raw = "";
  if (storageUrl.startsWith("data:application/json;base64,")) {
    raw = Buffer.from(
      storageUrl.slice("data:application/json;base64,".length),
      "base64"
    ).toString("utf8");
  } else {
    const res = await fetch(storageUrl);
    if (!res.ok) throw new Error(`تعذر تحميل النسخة: ${res.status}`);
    raw = await res.text();
  }

  const parsed = JSON.parse(raw) as {
    metadata?: { tables?: string[] };
    data?: Record<string, unknown[]>;
    checksum?: string;
  };

  if (snapshot.checksum) {
    const comparable = { ...parsed, checksum: "" };
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(comparable))
    );
    const checksum = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (checksum !== snapshot.checksum) {
      throw new Error("فشل تحقق سلامة النسخة الاحتياطية");
    }
  }

  return parsed;
}

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

    const backup = await loadBackupJson(snapshot);

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
    "https://azenith-living.vercel.app";
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

export async function executeBrowserResearch(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const query = String(params.query || params.objective || "").trim();
  if (!query) {
    return {
      success: false,
      message: "اكتب موضوع البحث أو الرابط الذي تريد من المتصفح الحي استكشافه.",
      executionId: context.executionId,
    };
  }

  const result = await runBrowserResearchMission({
    query,
    objective: typeof params.objective === "string" ? params.objective : undefined,
    maxSources: Number(params.maxSources) || 3,
  });

  return {
    success: result.success,
    message: result.message,
    data: result.data as unknown as Record<string, unknown>,
    executionId: context.executionId,
  };
}


export async function executeSpeedDeepAudit(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const url =
    (params.url as string) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://azenith-living.vercel.app";
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
    /**
     * One counting rule for the word «عميل». This tool used to read the profile ledger
     * alone and cap it at twenty, while the sales office read the shared roll of every
     * space a customer stands in — same word on the owner's screen, two answers, and a
     * buyer who exists in only one of them. It now asks the same reader the office asks
     * and reports the same number, including the ones with no way to reach them.
     */
    const { readCustomers } = await import("@/lib/customers/read");
    const roll = await readCustomers(supabase as never);
    if (roll.failures.length > 0) {
      return {
        success: false,
        message: `الدفتر ما ردّش: ${roll.failures.join(" · ")}`,
        executionId: context.executionId,
      };
    }
    const wanted = intent && intent !== "all" ? intent : null;
    const lines = (wanted ? roll.real.filter((c) => c.intent === wanted) : roll.real).slice(0, limit);
    const filteredNote = wanted ? ` (${wanted})` : "";
    const quiet = roll.totals.anonymous;
    return {
      success: true,
      message: `${lines.length} عميل${filteredNote} من الدفتر الواحد — الكل ${roll.totals.customers}، ومحتاج رد ${roll.totals.needingReply}` +
        (quiet ? `، و${quiet} بدون وسيلة وصول` : ""),
      data: {
        total: roll.totals.customers,
        needingReply: roll.totals.needingReply,
        anonymous: roll.totals.anonymous,
        customers: lines.map((c) => ({
          name: c.name,
          phone: c.phone,
          email: c.email,
          intent: c.intent,
          tier: c.tier,
          freshness: c.freshness.label,
          needsReply: c.needsReply,
          spaces: c.spaces,
        })),
      },
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

  if (!tenantId) {
    return {
      success: false,
      message: "tenantId مطلوب",
      executionId: context.executionId,
    };
  }

  try {
    const dossier = await buildLeadDossier(leadId, tenantId);
    if (!dossier) {
      return { success: false, message: "لم أجد الـ lead", executionId: context.executionId };
    }
    const sent = await sendTelegramDossier(dossier, tenantId);
    return {
      success: sent.success,
      message: sent.success
        ? `تم إرسال ملف العميل ${dossier.fullName} على تليجرام`
        : sent.error || "فشل الإرسال",
      data: { leadId, tier: dossier.qualification.tier, channel: "telegram" },
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
