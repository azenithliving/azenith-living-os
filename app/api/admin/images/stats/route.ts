import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from("curated_images")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (countError) throw countError;

    // Get distribution by room
    const { data: roomStats, error: roomError } = await supabase
      .rpc("get_curated_image_stats");

    if (roomError) throw roomError;

    // Get recent harvest logs
    const { data: refreshLogs, error: logsError } = await supabase
      .from("refresh_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    // Get API usage stats (if tracked)
    const { data: apiUsage } = await supabase
      .from("api_usage_log")
      .select("*")
      .order("date", { ascending: false })
      .limit(7);

    return NextResponse.json({
      success: true,
      stats: {
        total: totalCount || 0,
        target: 15000,
        percentage: Math.round(((totalCount || 0) / 15000) * 100),
        distribution: roomStats || [],
      },
      recentRefreshes: refreshLogs || [],
      apiUsage: apiUsage || [],
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error("[Image Stats API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
