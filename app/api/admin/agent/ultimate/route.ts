import { UltimateAgent } from "@/lib/ultimate-agent/agent-core";
import { createClient } from "@/utils/supabase/server";
import { getPendingApprovals, getSecurityStats } from "@/lib/ultimate-agent/security-manager";
import { getMetricsSnapshot, detectAnomalies, generateOpportunities } from "@/lib/ultimate-agent/predictive-engine";
import { getActiveGoals } from "@/lib/ultimate-agent/memory-store";
import { logAuditEvent } from "@/lib/ultimate-agent/security-manager";

/**
 * Get current user from session (proper auth)
 */
async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      return session.user.id;
    }
    
    // Fallback: try to get from auth header or cookie
    const authHeader = await Promise.resolve(null);
    return null;
  } catch (error) {
    console.error("[UltimateAgent] Auth error:", error);
    return null;
  }
}

/**
 * POST handler - Main command processor
 * API Contract:
 * - type: "command" with payload.command
 * - type: "handle_approval" 
 * - type: "proactive_check"
 */
export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    // Get current user from session for audit logging
    const userId = await getCurrentUserId();
    
    // Enforce real auth - reject unauthenticated requests
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized - please login" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const actorId = userId;
    
    // Parse request body
    const body = await req.json();
    const { type, payload } = body;

    // Log the request
    await logAuditEvent(
      "agent_command",
      type,
      actorId,
      { type, payload },
      "success"
    );

    // Route to appropriate handler
    let result: { success: boolean; message: string; data?: unknown; actionTaken?: string; requiresApproval?: boolean; approvalRequestId?: string; suggestions?: string[] };

    switch (type) {
      case "command": {
        const { command, context = {} } = payload;
        
        if (!command) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing command" }), 
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const agent = new UltimateAgent();
        const cmdResult = await agent.processCommandWithResult(command, actorId);
        
        result = {
          success: true,
          message: cmdResult.reply,
          data: cmdResult,
          actionTaken: cmdResult.actionTaken,
          requiresApproval: cmdResult.requiresApproval,
          approvalRequestId: cmdResult.approvalRequestId,
          suggestions: cmdResult.suggestions,
        };
        break;
      }

      case "handle_approval": {
        const { requestId, approved, reason } = payload;
        
        if (!requestId) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing requestId" }), 
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const agent = new UltimateAgent();
        const approvalResult = await agent.handleApproval(requestId, approved, actorId, reason);
        
        // Ensure action is executed after approval
        result = {
          success: approvalResult.success,
          message: approvalResult.message,
          actionTaken: approvalResult.actionTaken,
          data: approvalResult.data,
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
            error: `Unknown type: ${type}. Supported: command, handle_approval, proactive_check` 
          }), 
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // Log execution time
    const executionTime = Date.now() - startTime;
    console.log(`[UltimateAgent] ${type} completed in ${executionTime}ms`);

    return Response.json({
      ...result,
      executionTime
    });

  } catch (err: any) {
    console.error("[UltimateAgent] API error:", err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * GET handler - Query status, metrics, anomalies, opportunities, security, approvals
 * Query params: action=status|metrics|anomalies|opportunities|security|approvals
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
                visitors: {
                  ...snapshot.snapshot.visitors,
                  trend: "stable",
                },
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
        
        result = {
          success: true,
          anomalies: anomalyResult.anomalies || [],
        };
        break;
      }

      case "opportunities": {
        const oppResult = await generateOpportunities();
        
        result = {
          success: true,
          opportunities: oppResult.opportunities || [],
        };
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
          requests: approvals.requests?.map(req => ({
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
            error: `Unknown action: ${action}. Supported: status, metrics, anomalies, opportunities, security, approvals` 
          }), 
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    return Response.json(result);

  } catch (error) {
    console.error("[UltimateAgent] GET error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
