/**
 * Real-time Metrics API
 * 
 * Returns actual metrics from database instead of estimates
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startTime = searchParams.get("start") || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const endTime = searchParams.get("end") || new Date().toISOString();
    const companyId = searchParams.get("companyId") || null;

    const supabase = await createClient();

    // Get real metrics using database function
    const { data: metrics, error } = await supabase
      .rpc("calculate_real_metrics", {
        p_start_time: startTime,
        p_end_time: endTime,
        p_company_id: companyId,
      });

    if (error) {
      console.error("[Metrics API] Error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Transform to expected format
    const result = {
      period: {
        start: startTime,
        end: endTime,
      },
      visitors: {
        total: metrics?.find((m: { metric_name: string; metric_value: number }) => m.metric_name === 'total_visitors')?.metric_value || 0,
        unique: metrics?.find((m: { metric_name: string; metric_value: number }) => m.metric_name === 'unique_visitors')?.metric_value || 0,
        new: metrics?.find((m: { metric_name: string; metric_value: number }) => m.metric_name === 'unique_visitors')?.metric_value || 0,
        returning: metrics?.find((m: { metric_name: string; metric_value: number }) => m.metric_name === 'returning_visitor_rate')?.metric_value || 0,
      },
      pageViews: {
        total: metrics?.find((m: { metric_name: string; metric_value: number }) => m.metric_name === 'page_views')?.metric_value || 0,
        pagesPerSession: metrics?.find((m: { metric_name: string; metric_value: number }) => m.metric_name === 'pages_per_session')?.metric_value || 0,
      },
      engagement: {
        bounceRate: metrics?.find((m: { metric_name: string; metric_value: number }) => m.metric_name === 'bounce_rate')?.metric_value || 0,
        avgSessionDuration: metrics?.find((m: { metric_name: string; metric_value: number }) => m.metric_name === 'avg_session_duration')?.metric_value || 0,
      },
      calculatedAt: new Date().toISOString(),
      isReal: true, // Flag to indicate these are real metrics
    };

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error("[Metrics API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
