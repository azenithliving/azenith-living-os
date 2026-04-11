import { NextResponse } from "next/server";
import {
  getSystemHealth,
  getPendingAlerts,
  confirmAndApplyFix,
  dismissAlert,
  type SystemAlert,
} from "@/lib/sentinel";

/**
 * System Health API
 * Endpoint for the Sentinel Self-Healing Architecture
 */

export async function GET(): Promise<NextResponse> {
  try {
    const [health, pendingAlerts] = await Promise.all([
      getSystemHealth(),
      getPendingAlerts(),
    ]);

    return NextResponse.json({
      ok: true,
      health,
      pendingAlerts,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    
    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for applying fixes or dismissing alerts
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { action, alertId } = body;

    if (!alertId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Missing alertId parameter",
        },
        { status: 400 }
      );
    }

    let result: boolean;

    switch (action) {
      case "applyFix":
        result = await confirmAndApplyFix(alertId);
        break;
      
      case "dismiss":
        result = await dismissAlert(alertId);
        break;
      
      default:
        return NextResponse.json(
          {
            ok: false,
            message: "Invalid action. Use 'applyFix' or 'dismiss'",
          },
          { status: 400 }
        );
    }

    if (!result) {
      return NextResponse.json(
        {
          ok: false,
          message: `Failed to ${action} alert`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Alert ${action === "applyFix" ? "fix applied" : "dismissed"} successfully`,
      alertId,
      action,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    
    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}
