/*
 * Autonomous monitoring. Vercel Cron invokes this path with GET
 * (see vercel.json: 0 6 * * *) and Authorization: Bearer $CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { runAutonomousMonitoring } from "@/lib/proactive-agent";

async function run(request: NextRequest) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;

  try {
    console.log("[Cron] Starting autonomous monitoring...", new Date().toISOString());
    const result = await runAutonomousMonitoring();

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
