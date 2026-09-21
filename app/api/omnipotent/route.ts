import { NextRequest, NextResponse } from "next/server";
import { processQuery, executeStoredSuggestion, rejectSuggestion } from "@/lib/general-agent";
import { runManualCheck, getRecentSuggestions } from "@/lib/proactive-agent";
import { generateSystemSnapshot, getSystemOverview } from "@/lib/discovery-engine";
import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";

function unauthorizedResponse(error: unknown) {
  if (error instanceof AdminApiAuthError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdminApiAccess(request);
    const body = (await request.json()) as {
      action?: "query" | "execute" | "reject" | "monitor" | "snapshot" | "suggestions";
      query?: string;
      suggestionId?: string;
      reason?: string;
      checkType?: string;
    };

    switch (body.action) {
      case "query":
        if (!body.query?.trim()) {
          return NextResponse.json({ success: false, error: "Query is required" }, { status: 400 });
        }
        return NextResponse.json(await processQuery(body.query));

      case "execute":
        if (!body.suggestionId) {
          return NextResponse.json({ success: false, error: "suggestionId is required" }, { status: 400 });
        }
        return NextResponse.json(await executeStoredSuggestion(body.suggestionId, actor.userId));

      case "reject":
        if (!body.suggestionId) {
          return NextResponse.json({ success: false, error: "suggestionId is required" }, { status: 400 });
        }
        return NextResponse.json(await rejectSuggestion(body.suggestionId, actor.userId, body.reason));

      case "monitor":
        return NextResponse.json({ success: true, findings: await runManualCheck(body.checkType || "all"), timestamp: new Date().toISOString() });

      case "snapshot":
        return NextResponse.json({ success: true, snapshot: await generateSystemSnapshot() });

      case "suggestions":
        return NextResponse.json({ success: true, suggestions: await getRecentSuggestions(20) });

      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const authResponse = unauthorizedResponse(error);
    if (authResponse) return authResponse;
    console.error("[Omnipotent API] POST error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Internal error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const action = new URL(request.url).searchParams.get("action");

    if (action === "suggestions") {
      return NextResponse.json({ success: true, suggestions: await getRecentSuggestions(20) });
    }

    return NextResponse.json({
      success: true,
      overview: await getSystemOverview(),
      pendingSuggestions: (await getRecentSuggestions(10, "pending")).length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const authResponse = unauthorizedResponse(error);
    if (authResponse) return authResponse;
    console.error("[Omnipotent API] GET error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Internal error" }, { status: 500 });
  }
}
