import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Monthly Refresh Cron API
 * Called by Vercel Cron or external scheduler every 30 days
 * 
 * POST /api/cron/monthly-refresh
 * Headers: { "Authorization": "Bearer CRON_SECRET" }
 */

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.includes(CRON_SECRET || "")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Import and run refresh script
    const { runMonthlyRefresh, logRefreshRun, shouldRunRefresh } = await import("@/scripts/monthly-refresh");
    
    // Check if we should run (30 days passed)
    const shouldRun = await shouldRunRefresh();
    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        message: "Skipped - not yet 30 days since last refresh",
        run: false,
      });
    }

    // Run the refresh
    const report = await runMonthlyRefresh();
    
    // Log to database
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
        details: (error as Error).message 
      },
      { status: 500 }
    );
  }
}

// GET for status check
export async function GET(request: NextRequest) {
  try {
    const { shouldRunRefresh } = await import("@/scripts/monthly-refresh");
    
    const shouldRun = await shouldRunRefresh();
    
    return NextResponse.json({
      shouldRun,
      nextRun: shouldRun ? "now" : "in ~30 days",
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Status check failed" },
      { status: 500 }
    );
  }
}
