import { NextRequest, NextResponse } from "next/server";

import { getAnalyticsMetrics } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "30days";

    let days = 30;
    if (period === "7days") days = 7;
    else if (period === "90days") days = 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    const metrics = await getAnalyticsMetrics({
      startDate,
      endDate
    });

    return NextResponse.json({
      ok: true,
      metrics
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to get analytics metrics" },
      { status: 500 }
    );
  }
}