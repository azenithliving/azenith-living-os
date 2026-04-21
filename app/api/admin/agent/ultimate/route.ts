import { UltimateAgent } from "@/lib/ultimate-agent/agent-core";
import { getPendingApprovals, getSecurityStats, logAuditEvent } from "@/lib/ultimate-agent/security-manager";
import { getMetricsSnapshot, detectAnomalies, generateOpportunities } from "@/lib/ultimate-agent/predictive-engine";
import { getActiveGoals } from "@/lib/ultimate-agent/memory-store";
import { resolvePrimaryCompanyId } from "@/lib/company-resolver";
import { SovereignIntelligenceKernel } from "@/lib/sovereign-kernel";

export type ConversationMessage = { role: "user" | "assistant"; content: string };

type CommandLogEntry = {
  id: string;
};

function asUuidOrUndefined(value: string): string | undefined {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}

async function writeCommandLog(params: {
  actorId: string;
  command: string;
  status: "pending" | "executed" | "failed";
  resultSummary?: string;
  payload?: Record<string, unknown>;
}): Promise<CommandLogEntry | null> {
  const { getSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const basePayload = {
    user_id: params.actorId,
    command_text: params.command,
    status: params.status,
    result_summary: params.resultSummary || null,
    parameters: params.payload || {},
  };

  // Schema version A (serial id + text user_id)
  let insert = await supabase.from("immutable_command_log").insert(basePayload).select("id").single();
  if (!insert.error && insert.data) {
    return { id: String(insert.data.id) };
  }

  // Schema version B (uuid user_id + execution_time_ms)
  const uuidPayload = {
    ...basePayload,
    user_id: asUuidOrUndefined(params.actorId) || null,
    execution_time_ms: 0,
  };
  insert = await supabase.from("immutable_command_log").insert(uuidPayload).select("id").single();
  if (!insert.error && insert.data) {
    return { id: String(insert.data.id) };
  }

  return null;
}

/**
 * POST handler - Main command processor
 */
export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const actorId = req.headers.get("x-admin-user-id") || "admin_dashboard";
    const companyId = await resolvePrimaryCompanyId();
    const body = await req.json();
    const { type, payload } = body;

    await logAuditEvent(
      "agent_command",
      type,
      actorId,
      { type },
      "success",
      { companyId, actorUserId: asUuidOrUndefined(actorId) }
    );

    let result: {
      success: boolean;
      message: string;
      data?: unknown;
      actionTaken?: string;
      requiresApproval?: boolean;
      approvalRequestId?: string;
      suggestions?: string[];
    };

    switch (type) {
      case "command": {
        const { command, conversationHistory } = payload as {
          command: string;
          conversationHistory?: ConversationMessage[];
        };

        if (!command) {
          return new Response(JSON.stringify({ success: false, error: "Missing command" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const commandLog = await writeCommandLog({
          actorId,
          command,
          status: "pending",
          payload: { type, hasHistory: Array.isArray(conversationHistory) && conversationHistory.length > 0 },
        });

        const kernel = SovereignIntelligenceKernel.getInstance();
        const kernelReply = await kernel.processIntent(command, actorId);

        result = {
          success: true,
          message: kernelReply,
          actionTaken: "sovereign_intent_processed",
        };

        if (commandLog?.id) {
          await logAuditEvent(
            "agent_command_result",
            result.success ? "command_executed" : "command_failed",
            actorId,
            { type, commandLogId: commandLog.id, actionTaken: result.actionTaken },
            result.success ? "success" : "failure",
            { companyId, actorUserId: asUuidOrUndefined(actorId), commandLogId: commandLog.id }
          );
        }
        break;
      }

      case "handle_approval": {
        const { requestId, approved } = payload;

        if (!requestId) {
          return new Response(JSON.stringify({ success: false, error: "Missing requestId" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const agent = new UltimateAgent();
        const approvalResult = await agent.handleApproval(requestId, approved);

        result = {
          success: approvalResult.success,
          message: approvalResult.message,
          actionTaken: approvalResult.actionTaken,
        };
        break;
      }

      case "proactive_check": {
        const agent = new UltimateAgent();
        const checkResult = await agent.runProactiveCheck();

        result = {
          success: checkResult.success,
          message: checkResult.message,
          data: checkResult.data,
        };
        break;
      }

      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unknown type: ${type}. Supported: command, handle_approval, proactive_check`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const executionTime = Date.now() - startTime;
    console.log(`[UltimateAgent] ${type} completed in ${executionTime}ms`);

    return Response.json({
      ...result,
      executionTime,
      meta: { type, actorId, companyId },
    });
  } catch (error) {
    console.error("[UltimateAgent] API error:", error);
    const err = error instanceof Error ? error : new Error("Unknown error");
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        meta: { route: "admin/agent/ultimate" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * GET handler - Query status, metrics, anomalies, opportunities, security, approvals
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "status";

    let result: Record<string, unknown> & { success: boolean };

    switch (action) {
      case "status": {
        const agent = new UltimateAgent();
        const status = await agent.getAgentStatus();
        const goals = await getActiveGoals("high");

        result = {
          success: true,
          status: {
            isActive: status.isActive,
            mode: status.mode,
            actionsToday: status.actionsToday,
            pendingApprovals: status.pendingApprovals,
            goalsActive: goals.goals?.length || 0,
            anomaliesDetected: status.anomaliesDetected,
            modelMesh: status.modelMesh || [],
            capabilities: status.capabilities || [],
          },
        };
        break;
      }

      case "metrics": {
        const snapshot = await getMetricsSnapshot();

        result = {
          success: true,
          snapshot: snapshot.snapshot
            ? {
                visitors: { ...snapshot.snapshot.visitors, trend: "stable" },
                conversions: snapshot.snapshot.conversions,
                inquiries: snapshot.snapshot.business.inquiries,
                performance: snapshot.snapshot.performance,
              }
            : {
                visitors: { total: 0, unique: 0, new: 0, returning: 0, trend: "stable" },
                conversions: { total: 0, rate: 0, value: 0 },
                inquiries: 0,
                performance: { avgPageLoad: 0, bounceRate: 0, sessionDuration: 0 },
              },
        };
        break;
      }

      case "anomalies": {
        const anomalyResult = await detectAnomalies();
        result = { success: true, anomalies: anomalyResult.anomalies || [] };
        break;
      }

      case "opportunities": {
        const oppResult = await generateOpportunities();
        result = { success: true, opportunities: oppResult.opportunities || [] };
        break;
      }

      case "security": {
        const securityStats = await getSecurityStats();
        result = {
          success: true,
          stats: securityStats.stats || {
            pendingApprovals: 0,
            approvedToday: 0,
            rejectedToday: 0,
            criticalActionsToday: 0,
          },
        };
        break;
      }

      case "approvals": {
        const approvals = await getPendingApprovals();
        result = {
          success: true,
          requests:
            approvals.requests?.map((req) => ({
              id: req.id,
              actionType: req.actionType,
              description: req.description,
              riskLevel: req.riskLevel,
              requestedAt: req.requestedAt?.toISOString(),
            })) || [],
        };
        break;
      }

      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unknown action: ${action}. Supported: status, metrics, anomalies, opportunities, security, approvals`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    return Response.json({
      ...result,
      meta: { action },
    });
  } catch (error) {
    console.error("[UltimateAgent] GET error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
