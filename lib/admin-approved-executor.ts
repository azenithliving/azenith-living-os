/**
 * Executes approved admin proposals — real commands, tools, agents, genesis.
 */

import { createClient } from "@supabase/supabase-js";
import { executeCommand, type CommandContext } from "./command-executor";
import { runAdminAgentMission } from "./aaca-client";
import { runGenesisManifest, runUltimateTool } from "./admin-tool-bridge";
import { executeStoredSuggestion } from "./general-agent";
import type { ClassifiedIntent } from "./admin-intent-types";

export interface AdminProposalMetadata {
  executor: "admin_assistant";
  intent: ClassifiedIntent;
  userMessage: string;
  userEmail?: string;
  userId?: string;
  reasoning?: string;
  proactive?: boolean;
  suggestionId?: string;
}

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function executeAdminProposal(
  metadata: AdminProposalMetadata,
  approvedBy: string
): Promise<{ success: boolean; message: string; data?: unknown }> {
  const intent = metadata.intent;
  const supabase = getServiceSupabase();
  const commandCtx: CommandContext = {
    supabase,
    userId: metadata.userId || approvedBy,
    userEmail: metadata.userEmail || "admin@azenithliving.com",
    bypassRls: true,
    isOwner: true,
  };

  try {
    if (metadata.suggestionId) {
      const r = await executeStoredSuggestion(metadata.suggestionId, approvedBy);
      return {
        success: r.success,
        message: r.success ? "تم تنفيذ الاقتراح المخزّن." : r.error || "فشل التنفيذ",
        data: r.result,
      };
    }

    switch (intent.kind) {
      case "command": {
        const line =
          intent.commandLine ||
          (intent.command ? `${intent.command}` : "help");
        const result = await executeCommand(line, commandCtx);
        return {
          success: result.success,
          message: result.message,
          data: result.data,
        };
      }
      case "agents": {
        const mission = await runAdminAgentMission(
          metadata.userMessage,
          metadata.userEmail || "admin@azenithliving.com"
        );
        return {
          success: true,
          message: mission.message,
          data: mission.task,
        };
      }
      case "ultimate_tool": {
        const toolName = intent.toolName || "seo_analyze";
        const result = await runUltimateTool(
          toolName,
          intent.toolParams || {},
          {
            userId: metadata.userId || approvedBy,
            userEmail: metadata.userEmail,
            companyId: process.env.MASTER_COMPANY_ID,
          }
        );
        return {
          success: result.success,
          message: result.message || result.error || "تم",
          data: result.data,
        };
      }
      case "genesis": {
        const genesis = await runGenesisManifest(metadata.userMessage);
        return {
          success: genesis.success,
          message: genesis.success
            ? `${genesis.manifestedReality}\n${(genesis.actionsTaken || []).join("، ")}`
            : genesis.error || "فشل Genesis",
          data: genesis,
        };
      }
      case "architect": {
        const arch = await import("./architect-tools");
        if (intent.architectAction === "updateSiteSetting") {
          const r = await arch.updateSiteSetting(
            (intent.architectParams || { key: "theme", value: {} }) as {
              key: "theme" | "seo" | "general";
              value: Record<string, unknown>;
            }
          );
          return { success: !!r.success, message: r.message || "", data: r.data };
        }
        if (intent.architectAction === "createAutomationRule") {
          const r = await arch.createAutomationRule({
            name: "قاعدة من الأدمن",
            trigger: "page_visit",
            conditions: {},
            actions: [{ type: "notification" }],
            ...(intent.architectParams || {}),
          } as Parameters<typeof arch.createAutomationRule>[0]);
          return { success: !!r.success, message: r.message || "", data: r.data };
        }
        return { success: false, message: "إجراء معماري غير معروف" };
      }
      case "analytics": {
        const r = await import("./architect-tools").then((m) =>
          m.getAnalyticsReport({ days: intent.analyticsDays || 7 })
        );
        return { success: !!r.success, message: r.message || "", data: r.data };
      }
      case "health": {
        const r = await import("./architect-tools").then((m) => m.getSystemHealth());
        return { success: !!r.success, message: r.message || "", data: r.data };
      }
      default:
        return { success: false, message: "لا يوجد منفّذ لهذا النوع" };
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "خطأ في التنفيذ",
    };
  }
}

export async function approveAdminProposal(
  requestId: string,
  approvedBy: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const supabase = getServiceSupabase();
  const { data: request, error } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (error || !request) {
    return { success: false, message: "", error: "طلب الموافقة غير موجود" };
  }
  if (request.status !== "pending") {
    return { success: false, message: "", error: `الطلب ${request.status} مسبقاً` };
  }

  const rawMeta = request.metadata as Record<string, unknown> | null;
  if (
    rawMeta?.executor === "cloud_evolution" &&
    (rawMeta.patch || rawMeta.patches)
  ) {
    const { applyCloudEvolutionFromApproval, triggerVercelDeploy } = await import(
      "./admin-cloud-evolution"
    );
    const patches = rawMeta.patches as import("./admin-cloud-evolution").CloudPatchPayload[] | undefined;
    if (patches?.length && rawMeta.prUrl) {
      const deploy = await triggerVercelDeploy();
      const exec = {
        success: true,
        message: `تمت الموافقة على ${patches.length} ملف. PR: ${rawMeta.prUrl}\n${deploy.message}`,
      };
      await supabase
        .from("approval_requests")
        .update({
          status: "approved",
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      return { success: exec.success, message: exec.message };
    }
    const exec = await applyCloudEvolutionFromApproval({
      patch: rawMeta.patch as import("./admin-cloud-evolution").CloudPatchPayload,
      prUrl: rawMeta.prUrl as string | undefined,
    });
    await supabase
      .from("approval_requests")
      .update({
        status: exec.success ? "approved" : "rejected",
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        rejection_reason: exec.success ? null : exec.message,
      })
      .eq("id", requestId);
    return { success: exec.success, message: exec.message, error: exec.success ? undefined : exec.message };
  }

  const metadata = request.metadata as AdminProposalMetadata | null;
  if (!metadata || metadata.executor !== "admin_assistant") {
    return { success: false, message: "", error: "هذا الطلب ليس من المساعد الموحّد" };
  }

  const exec = await executeAdminProposal(metadata, approvedBy);

  await supabase
    .from("approval_requests")
    .update({
      status: exec.success ? "approved" : "rejected",
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      rejection_reason: exec.success ? null : exec.message,
    })
    .eq("id", requestId);

  if (exec.success) {
    try {
      const { storeMemory } = await import("./ultimate-agent/memory-store");
      await storeMemory({
        type: "learning",
        category: "admin_approved_action",
        content: `نُفّذ بعد موافقة المالك: ${request.description}. النتيجة: ${exec.message.slice(0, 500)}`,
        priority: "normal",
        context: { requestId, intent: metadata.intent.kind },
      });
    } catch {
      /* memory optional */
    }
  }

  return {
    success: exec.success,
    message: exec.message,
    error: exec.success ? undefined : exec.message,
  };
}

export async function rejectAdminProposal(
  requestId: string,
  rejectedBy: string,
  reason?: string
): Promise<{ success: boolean }> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("approval_requests")
    .update({
      status: "rejected",
      approved_by: rejectedBy,
      approved_at: new Date().toISOString(),
      rejection_reason: reason || "رفض من المالك",
    })
    .eq("id", requestId)
    .eq("status", "pending");

  return { success: !error };
}
