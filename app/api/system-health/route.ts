import { NextResponse } from "next/server";
import {
  getSystemHealth,
  getPendingAlerts,
  confirmAndApplyFix,
  dismissAlert,
} from "@/lib/sentinel";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * System Health API
 * Endpoint for the Sentinel Self-Healing Architecture
 *
 * Opening this door is what the watcher does its readings on, and every answer it gives is written in
 * the owner's Arabic: the two screens that call it print `message` straight into a red box, so an
 * English failure sentence here is an English sentence on his phone.
 */

export async function GET(): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

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
    console.error("[system-health] الفحص فشل:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "الفحص ما كملش — الرجاء المحاولة تاني.",
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
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const { action, alertId } = body;

    if (!alertId) {
      return NextResponse.json(
        {
          ok: false,
          message: "التنبيه اللي بتتكلم عنه مش محدد.",
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
            message: "إجراء مش معروف — اختَر تطبيق المقترح أو المراجعة والإخفاء.",
          },
          { status: 400 }
        );
    }

    if (!result) {
      return NextResponse.json(
        {
          ok: false,
          message:
            action === "applyFix"
              ? "الإجراء ما اتنفذش — التنبيه فضّل مستني قرار."
              : "التنبيه ما اتقفلش — فضّل مستني قرار.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: action === "applyFix" ? "الإجراء اتسجّل على التنبيه." : "التنبيه اتسجّل إنه اتراجع.",
      alertId,
      action,
    });

  } catch (error) {
    console.error("[system-health] إجراء فشل:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "الإجراء ما اتنفذش — الرجاء المحاولة تاني.",
      },
      { status: 500 }
    );
  }
}
