/**
 * Omnipotent Agent API
 * Main endpoint for the General Agent - handles queries, planning, and execution
 */

import { NextRequest, NextResponse } from "next/server";
import { processQuery, executeStoredSuggestion, rejectSuggestion } from "@/lib/general-agent";
import { runManualCheck, getRecentSuggestions } from "@/lib/proactive-agent";
import { generateSystemSnapshot, getSystemOverview } from "@/lib/discovery-engine";

// Security: Verify internal key or admin session
async function verifyAccess(request: NextRequest): Promise<boolean> {
  const internalKey = request.headers.get("X-Internal-Key");
  if (internalKey === process.env.INTERNAL_API_KEY) {
    return true;
  }

  // Additional admin verification can be added here
  // For now, we'll rely on the internal key
  return false;
}

/**
 * POST /api/omnipotent
 * Main endpoint for querying the General Agent
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAccess(request))) {
      return NextResponse.json(
        { error: "Unauthorized. Internal key required." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      action: "query" | "execute" | "reject" | "monitor" | "snapshot" | "suggestions";
      query?: string;
      suggestionId?: string;
      userId?: string;
      reason?: string;
      checkType?: string;
    };

    switch (body.action) {
      case "query": {
        if (!body.query) {
          return NextResponse.json(
            { error: "Query is required" },
            { status: 400 }
          );
        }

        const result = await processQuery(body.query);
        return NextResponse.json(result);
      }

      case "execute": {
        if (!body.suggestionId || !body.userId) {
          return NextResponse.json(
            { error: "suggestionId and userId are required" },
            { status: 400 }
          );
        }

        const result = await executeStoredSuggestion(body.suggestionId, body.userId);
        return NextResponse.json(result);
      }

      case "reject": {
        if (!body.suggestionId || !body.userId) {
          return NextResponse.json(
            { error: "suggestionId and userId are required" },
            { status: 400 }
          );
        }

        const result = await rejectSuggestion(body.suggestionId, body.userId, body.reason);
        return NextResponse.json(result);
      }

      case "monitor": {
        const findings = await runManualCheck(body.checkType || "all");
        return NextResponse.json({
          success: true,
          findings,
          timestamp: new Date().toISOString(),
        });
      }

      case "snapshot": {
        const snapshot = await generateSystemSnapshot();
        return NextResponse.json({
          success: true,
          snapshot,
        });
      }

      case "suggestions": {
        const suggestions = await getRecentSuggestions(20);
        return NextResponse.json({
          success: true,
          suggestions,
        });
      }

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Omnipotent API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/omnipotent
 * Quick system overview endpoint
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await verifyAccess(request))) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const overview = await getSystemOverview();
    const suggestions = await getRecentSuggestions(10, "pending");

    return NextResponse.json({
      success: true,
      overview,
      pendingSuggestions: suggestions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Omnipotent API] GET Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
