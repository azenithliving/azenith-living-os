import { NextRequest, NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";

/**
 * Monthly image/content refresh. Vercel Cron invokes GET
 * (vercel.json: 0 0 1 * *) with Authorization: Bearer $CRON_SECRET.
 */

async function run(request: NextRequest) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;

  try {
    const { runMonthlyRefresh, logRefreshRun, shouldRunRefresh } = await import("@/scripts/monthly-refresh");

    const shouldRun = await shouldRunRefresh();
    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        message: "Skipped - not yet 30 days since last refresh",
        run: false,
      });
    }

    const report = await runMonthlyRefresh();
    await logRefreshRun(report);

    return NextResponse.json({
      success: true,
      message: "Monthly refresh completed",
      run: true,
      report,
    });
  } catch (error) {
    console.error("[Monthly Refresh API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Refresh failed",
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
