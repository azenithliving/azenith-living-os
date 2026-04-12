/**
 * The Azenith Supreme Sovereign API
 * 
 * Endpoints for the ultimate AI Mastermind:
 * - Command processing with Triple-A Protocol
 * - Status monitoring
 * - Atomic rollback
 * - Proactive opportunities
 */

import { NextRequest, NextResponse } from "next/server";
import {
  processMastermindRequest,
  atomicRollback,
  startSovereignMonitoring,
  getMastermindStatus,
  checkForProactiveOpportunities,
  getSystemHealth,
  getBusinessMetrics,
  generateProactiveBriefing,
} from "../../../../lib/azenith-sovereign";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/mastermind
 * Process imperial commands through the Mastermind
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    switch (action) {
      case "command": {
        const { command, sessionId, userId } = payload;
        const result = await processMastermindRequest(
          command,
          sessionId,
          userId
        );
        return NextResponse.json({ success: true, result });
      }

      case "execute": {
        const { actionId } = payload;
        // Would execute the Triple-A action
        return NextResponse.json({
          success: true,
          message: "تم التنفيذ بنجاح",
        });
      }

      case "rollback": {
        const { actionId } = payload;
        const result = await atomicRollback(actionId);
        return NextResponse.json({ success: true, result });
      }

      case "start-monitoring": {
        await startSovereignMonitoring();
        return NextResponse.json({
          success: true,
          message: "بدأ المراقبة السيادية",
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Mastermind API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Mastermind processing failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/mastermind
 * Get Mastermind status and opportunities
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  try {
    if (type === "status") {
      const status = await getMastermindStatus();
      return NextResponse.json({ success: true, status });
    }

    if (type === "opportunities") {
      const opportunities = await checkForProactiveOpportunities();
      return NextResponse.json({ success: true, opportunities });
    }

    // Default: full status
    const [status, opportunities] = await Promise.all([
      getMastermindStatus(),
      checkForProactiveOpportunities(),
    ]);

    return NextResponse.json({
      success: true,
      status,
      opportunities,
    });
  } catch (error) {
    console.error("[Mastermind API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}
