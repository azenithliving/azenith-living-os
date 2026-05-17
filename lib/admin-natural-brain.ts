/**
 * Admin Natural Language Brain
 * Speak normally (Arabic/English) — the system decides what to run and executes it.
 * Uses the full API key pool via askOrchestrator + Mastermind + Cloud Agents.
 */

import { createClient } from "@supabase/supabase-js";
import { executeCommand } from "./command-executor";
import {
  createAutomationRule,
  getAnalyticsReport,
  getSystemHealth,
  updateSiteSetting,
} from "./architect-tools";
import { runAdminAgentMission } from "./aaca-client";
import type { AIResponse } from "./mastermind-ai";
import { generateAIResponse, loadHistory, saveMessage } from "./mastermind-ai";
import {
  formatCommandResultForUser,
  isGenericAiFailureMessage,
} from "./admin-response-format";
import type { ClassifiedIntent } from "./admin-intent-types";
import { buildExecutionPlan } from "./admin-planner";
import { buildCapabilitySummaryForUser } from "./admin-capability-manifest";
import { recordExecutionLearning } from "./admin-capability-evolution";
import {
  parseRememberInstruction,
  rememberOwnerPreference,
  buildOwnerMemoryPrompt,
} from "./admin-owner-memory";
import { buildAdminDailyReport } from "./admin-daily-report";
import {
  classifyAdminIntent,
  detectActionOrientedRequest,
  needsMultiAgentMission,
} from "./admin-intent-classifier";
import { createAdminProposal } from "./admin-sovereign-mind";
import { requiresOwnerApproval } from "./admin-approval-policy";
import { runGenesisManifest, runUltimateTool } from "./admin-tool-bridge";

export type { IntentKind, ClassifiedIntent } from "./admin-intent-types";
export { needsMultiAgentMission } from "./admin-intent-classifier";

export type AdminBrainSource =
  | "mastermind"
  | "smart"
  | "ultimate"
  | "architect"
  | "agent_chat"
  | "sales"
  | "genesis";

export interface AdminBrainContext {
  sessionId: string;
  userId?: string;
  userEmail: string;
  bypassRls?: boolean;
  isOwner?: boolean;
  source?: AdminBrainSource;
  agentKey?: string;
}

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function finalizeReply(
  message: string,
  intent: ClassifiedIntent,
  body: string
): string {
  const plan = buildExecutionPlan(message, intent);
  return `${plan}\n\n${body}`;
}

function describeIntentForOwner(intent: ClassifiedIntent, message: string): string {
  if (intent.kind === "command") {
    return `تنفيذ أمر: ${intent.commandLine || intent.command || message}`;
  }
  if (intent.kind === "ultimate_tool") {
    return `تشغيل أداة: ${intent.toolName || "ultimate"}`;
  }
  if (intent.kind === "agents") return `مهمة وكلاء سحابيين: ${message.slice(0, 120)}`;
  if (intent.kind === "genesis") return `Genesis / تكوين: ${message.slice(0, 120)}`;
  return message.slice(0, 160);
}

/**
 * Main entry: natural language in → automatic execution out.
 */
export async function processAdminNaturalLanguage(
  message: string,
  ctx: AdminBrainContext
): Promise<AIResponse> {
  const {
    sessionId,
    userId,
    userEmail,
    bypassRls = false,
    isOwner = false,
  } = ctx;

  const history = userId ? await loadHistory(userId) : [];

  await saveMessage({
    session_id: sessionId,
    user_id: userId,
    role: "user",
    content: message,
  });

  const remember = parseRememberInstruction(message);
  if (remember && userId) {
    await rememberOwnerPreference(userId, remember.key, remember.value);
    const memHint = await buildOwnerMemoryPrompt(userId);
    const reply = `✅ **حفظت تفضيلك:** ${remember.key}\n${remember.value}${memHint ? `\n\n${memHint}` : ""}`;
    await saveMessage({
      session_id: sessionId,
      user_id: userId,
      role: "assistant",
      content: reply,
    });
    return { type: "conversation", message: reply };
  }

  if (/تقرير.*يومي|daily\s*report|ملخص.*اليوم/i.test(message)) {
    const report = await buildAdminDailyReport();
    await saveMessage({
      session_id: sessionId,
      user_id: userId,
      role: "assistant",
      content: report.fullTextAr,
    });
    return { type: "mixed", message: report.fullTextAr };
  }

  let intent = await classifyAdminIntent(message, history);
  if (
    intent.kind === "conversation" &&
    detectActionOrientedRequest(message)
  ) {
    intent = { kind: "agents", confidence: 0.68, reasoning: "action-escalation" };
  }
  const supabase = getServiceSupabase();
  const commandCtx = {
    supabase,
    userId: userId || "00000000-0000-0000-0000-000000000000",
    userEmail,
    bypassRls,
    isOwner,
  };

  let response: AIResponse;

  try {
    if (requiresOwnerApproval(intent)) {
      const proposal = await createAdminProposal({
        title: "طلب تنفيذ من المساعد",
        description: describeIntentForOwner(intent, message),
        reasoning: intent.reasoning || "يتطلب موافقة المالك",
        userMessage: message,
        intent,
        userId,
        userEmail,
      });
      const reply = proposal.success
        ? `🛡️ **أحتاج إذنك قبل التنفيذ**\n\n${describeIntentForOwner(intent, message)}\n\n**لماذا:** ${intent.reasoning || "إجراء حساس أو واسع النطاق"}\n\n✅ راجع لوحة «عقل النظام» على اليمين واضغط **موافقة** أو **رفض**. لن أنفّذ شيئاً حتى توافق.`
        : `🛡️ أحتاج موافقتك لكن تعذر حفظ الطلب: ${proposal.error || "خطأ"}. جرّب من لوحة عقل النظام.`;
      response = {
        type: "conversation",
        message: finalizeReply(message, intent, reply),
        command: proposal.requestId
          ? { name: "awaiting_approval", args: [], result: { requestId: proposal.requestId } }
          : undefined,
      };
    } else switch (intent.kind) {
      case "command": {
        const line =
          intent.commandLine ||
          (intent.command ? `${intent.command}` : "help");
        const commandResult = await executeCommand(line, commandCtx);
        const cmdName = intent.command || line.split(/\s+/)[0];
        let reply = formatCommandResultForUser(commandResult, cmdName);
        try {
          const aiMessage = await generateAIResponse(message, history, {
            commandExecuted: cmdName,
            commandResult,
          });
          if (!isGenericAiFailureMessage(aiMessage)) {
            reply = aiMessage;
          }
        } catch {
          /* keep formatted command result */
        }
        response = {
          type: "mixed",
          message: finalizeReply(message, intent, reply),
          command: {
            name: intent.command || line.split(/\s+/)[0],
            args: line.split(/\s+/).slice(1),
            result: commandResult,
          },
        };
        break;
      }

      case "agents": {
        const mission = await runAdminAgentMission(message, userEmail);
        let reply = mission.message;
        if (mission.delegated) {
          try {
            const aiMessage = await generateAIResponse(message, history, {
              commandExecuted: "agent_mission",
              commandResult: {
                success: true,
                data: mission.task,
                message: mission.message,
              },
            });
            if (!isGenericAiFailureMessage(aiMessage)) reply = aiMessage;
          } catch {
            /* mission.message */
          }
        }
        response = {
          type: mission.delegated ? "mixed" : "conversation",
          message: finalizeReply(message, intent, reply),
          command: mission.delegated
            ? {
                name: "agent_mission",
                args: [],
                result: { success: true, data: mission.task },
              }
            : undefined,
        };
        break;
      }

      case "analytics": {
        const report = await getAnalyticsReport({ days: intent.analyticsDays || 7 });
        let reply =
          report.success && report.message
            ? report.message
            : "تم جلب التحليلات.";
        try {
          const aiMessage = await generateAIResponse(message, history, {
            commandExecuted: "analytics",
            commandResult: report,
          });
          if (!isGenericAiFailureMessage(aiMessage)) reply = aiMessage;
        } catch {
          /* keep report message */
        }
        response = {
          type: "mixed",
          message: finalizeReply(message, intent, reply),
        };
        break;
      }

      case "health": {
        const health = await getSystemHealth();
        let reply = health.success && health.message ? health.message : "تم فحص النظام.";
        try {
          const aiMessage = await generateAIResponse(message, history, {
            commandExecuted: "system_health",
            commandResult: health,
          });
          if (!isGenericAiFailureMessage(aiMessage)) reply = aiMessage;
        } catch {
          /* keep health message */
        }
        response = {
          type: "mixed",
          message: finalizeReply(message, intent, reply),
        };
        break;
      }

      case "ultimate_tool": {
        const toolName = intent.toolName || "seo_analyze";
        const toolResult = await runUltimateTool(
          toolName,
          intent.toolParams || {},
          { userId: userId || "admin", userEmail, companyId: process.env.MASTER_COMPANY_ID }
        );
        const body =
          toolResult.success && toolResult.message
            ? toolResult.message
            : toolResult.error || "لم تكتمل الأداة.";
        response = {
          type: "mixed",
          message: finalizeReply(message, intent, body),
          command: {
            name: toolName,
            args: [],
            result: toolResult,
          },
        };
        break;
      }

      case "genesis": {
        const genesis = await runGenesisManifest(message);
        const body = genesis.success
          ? `${genesis.manifestedReality}\n\nالإجراءات: ${(genesis.actionsTaken || []).join("، ") || "—"}`
          : genesis.error || "فشل التكوين.";
        response = {
          type: genesis.success ? "mixed" : "conversation",
          message: finalizeReply(message, intent, body),
          command: genesis.success
            ? { name: "genesis", args: [], result: genesis }
            : undefined,
        };
        break;
      }

      case "architect": {
        let execResult: { success?: boolean; message?: string; error?: string; data?: unknown } | null = null;
        if (intent.architectAction === "updateSiteSetting") {
          execResult = await updateSiteSetting(
            (intent.architectParams || { key: "theme", value: {} }) as {
              key: "theme" | "seo" | "general";
              value: Record<string, unknown>;
            }
          );
        } else if (intent.architectAction === "createAutomationRule") {
          const ruleInput = {
            name: "قاعدة من الأدمن",
            trigger: "page_visit" as const,
            conditions: {},
            actions: [{ type: "notification" }],
            ...(intent.architectParams || {}),
          };
          execResult = await createAutomationRule(
            ruleInput as Parameters<typeof createAutomationRule>[0]
          );
        }
        let reply =
          execResult?.success && execResult.message
            ? execResult.message
            : "تم تنفيذ إعداد المعماري.";
        try {
          const aiMessage = await generateAIResponse(message, history, {
            commandExecuted: intent.architectAction || "architect",
            commandResult: execResult,
          });
          if (!isGenericAiFailureMessage(aiMessage)) reply = aiMessage;
        } catch {
          /* keep exec result */
        }
        response = {
          type: "mixed",
          message: finalizeReply(message, intent, reply),
        };
        break;
      }

      case "conversation":
      default: {
        let reply = buildCapabilitySummaryForUser();
        try {
          const aiMessage = await generateAIResponse(message, history);
          if (!isGenericAiFailureMessage(aiMessage)) reply = aiMessage;
        } catch {
          /* capability summary */
        }
        response = {
          type: "conversation",
          message: finalizeReply(message, intent, reply),
        };
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "خطأ غير معروف";
    let reply = `واجهت عقبة تقنية: ${errMsg}`;
    try {
      const mission = await runAdminAgentMission(message, userEmail);
      if (mission.message) reply = mission.message;
    } catch {
      /* keep err */
    }
    try {
      const aiMessage = await generateAIResponse(message, history, {
        commandResult: { success: false, error: errMsg },
      });
      if (!isGenericAiFailureMessage(aiMessage)) reply = aiMessage;
    } catch {
      reply = `${reply}\n\n${buildCapabilitySummaryForUser()}`;
    }
    response = { type: "conversation", message: finalizeReply(message, intent, reply) };
  }

  await saveMessage({
    session_id: sessionId,
    user_id: userId,
    role: "assistant",
    content: response.message,
    command_executed: response.command?.name,
    command_result: response.command?.result
      ? JSON.stringify(response.command.result)
      : undefined,
  });

  const cmdResult = response.command?.result as { success?: boolean } | undefined;
  const executedOk =
    response.type === "mixed" &&
    (cmdResult?.success !== false || !cmdResult);
  void recordExecutionLearning({
    message,
    intent,
    success: executedOk || intent.kind === "conversation",
  }).catch(() => {});

  return response;
}

/**
 * Lightweight handler for routes that only need a text reply (smart, agents, sales).
 */
export async function processAdminNaturalLanguageReply(
  message: string,
  ctx: Omit<AdminBrainContext, "sessionId"> & { sessionId?: string }
): Promise<{
  success: boolean;
  reply: string;
  type: string;
  executed?: boolean;
  data?: unknown;
}> {
  const result = await processAdminNaturalLanguage(message, {
    sessionId: ctx.sessionId || `admin-${ctx.source || "generic"}-${Date.now()}`,
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    bypassRls: ctx.bypassRls,
    isOwner: ctx.isOwner,
    source: ctx.source,
    agentKey: ctx.agentKey,
  });

  return {
    success: true,
    reply: result.message,
    type: result.type,
    executed: result.type === "mixed",
    data: result.command?.result,
  };
}
