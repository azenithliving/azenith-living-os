/*
 * Autonomous Monitoring Cron Job
 * Runs every 6 hours to check system health and generate suggestions
 *
 * To enable, add to Vercel or set up external cron:
 * Every 6 hours POST to /api/cron/autonomous-monitoring
 * Header: Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { runAutonomousMonitoring } from "@/lib/proactive-agent";

/**
 * POST /api/cron/autonomous-monitoring
 * Triggered by cron service every 6 hours
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[Cron] Starting autonomous monitoring...", new Date().toISOString());

    // Run the monitoring
    const result = await runAutonomousMonitoring();

    console.log("[Cron] Monitoring complete:", {
      findings: result.findings.length,
      suggestions: result.suggestionsGenerated,
    });

    return NextResponse.json({
      success: true,
      timestamp: result.timestamp,
      findingsCount: result.findings.length,
      suggestionsGenerated: result.suggestionsGenerated,
      summary: result.findings.map((f) => ({
        type: f.type,
        severity: f.severity,
        title: f.title,
      })),
    });
  } catch (error) {
    console.error("[Cron] Autonomous monitoring failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/autonomous-monitoring
 * For testing - returns status and last run info
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      status: "ready",
      message: "POST to this endpoint to trigger autonomous monitoring",
      expectedInterval: "Every 6 hours",
      documentation: "https://github.com/azenithliving/docs/autonomous-monitoring",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
