/**
 * Proactive Autonomy API - Health Monitoring & Predictive Maintenance
 * 
 * Endpoints:
 * - GET /api/admin/proactive - Current health status
 * - POST /api/admin/proactive/check - Trigger manual health check
 * - POST /api/admin/proactive/acknowledge - Acknowledge issue
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentHealth, performHealthCheck, acknowledgeIssue, resolveIssue } from "@/lib/proactive-autonomy";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/proactive
 * Get current system health status
 */
export async function GET() {
  try {
    const health = await getCurrentHealth();
    return NextResponse.json({ success: true, health });
  } catch (error) {
    console.error("[Proactive API] Error fetching health:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch health status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/proactive
 * Actions: check, acknowledge, resolve
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    switch (action) {
      case "check": {
        const result = await performHealthCheck();
        return NextResponse.json({ success: true, result });
      }

      case "acknowledge": {
        const { issueId, userId } = payload;
        if (!issueId || !userId) {
          return NextResponse.json(
            { success: false, error: "Missing issueId or userId" },
            { status: 400 }
          );
        }
        await acknowledgeIssue(issueId, userId);
        return NextResponse.json({ success: true, message: "Issue acknowledged" });
      }

      case "resolve": {
        const { issueId } = payload;
        if (!issueId) {
          return NextResponse.json(
            { success: false, error: "Missing issueId" },
            { status: 400 }
          );
        }
        await resolveIssue(issueId);
        return NextResponse.json({ success: true, message: "Issue resolved" });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Proactive API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Action failed" },
      { status: 500 }
    );
  }
}
