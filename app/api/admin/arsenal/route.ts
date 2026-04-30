/**
 * Sovereign OS Arsenal API
 * Resource management endpoints for the Intelligent HUD
 */

import { NextRequest, NextResponse } from "next/server";
import { getSystemStats, clearCache, triggerHealing, setKeyStatus } from "@/lib/sovereign-os";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/arsenal
 * Get full system stats for the Intelligent HUD
 */
export async function GET() {
  try {
    const stats = await getSystemStats();
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error("[Arsenal API] Error fetching stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch system stats" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/arsenal
 * Actions: clear-cache, trigger-heal, update-key-status
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    switch (action) {
      case "clear-cache": {
        const count = await clearCache(payload?.contentType);
        return NextResponse.json({
          success: true,
          message: `Cleared ${count} cache entries`,
          count,
        });
      }

      case "trigger-heal": {
        const results = await triggerHealing();
        return NextResponse.json({
          success: true,
          message: `Healing completed: ${results.length} actions taken`,
          results,
        });
      }

      case "update-key-status": {
        const { keyId, status } = payload;
        if (!keyId || !status) {
          return NextResponse.json(
            { success: false, error: "Missing keyId or status" },
            { status: 400 }
          );
        }
        const success = await setKeyStatus(keyId, status);
        return NextResponse.json({
          success,
          message: success ? `Key ${keyId} status updated to ${status}` : "Failed to update key status",
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Arsenal API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
