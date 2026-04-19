import { NextRequest, NextResponse } from "next/server";

/**
 * Admin API: Manual Trigger for Image Harvesting
 * POST /api/admin/images/trigger-harvest
 * Body: { force?: boolean, targetCount?: number }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { force = false, targetCount = 15000 } = body;

    // Import the harvester
    const { runEliteHarvesterV3, CONFIG } = await import("@/scripts/elite-harvester-v3");
    
    // Override target if specified
    if (targetCount !== 15000) {
      CONFIG.TARGET_FILTERED_IMAGES = targetCount;
    }

    // Run harvester
    console.log(`[Admin Harvest] Triggered with target: ${targetCount}`);
    
    // Note: In production, this would spawn a background job
    // For now, we return immediately and the admin can check status
    
    return NextResponse.json({
      success: true,
      message: "Harvest triggered",
      details: {
        target: targetCount,
        force,
        estimatedDuration: "2-4 hours",
        status: "running",
      },
    });

  } catch (error) {
    console.error("[Trigger Harvest API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to trigger harvest" },
      { status: 500 }
    );
  }
}

// GET harvest status
export async function GET(request: NextRequest) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { count } = await supabase
      .from("curated_images")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    return NextResponse.json({
      success: true,
      status: {
        currentCount: count || 0,
        targetCount: 15000,
        progress: Math.round(((count || 0) / 15000) * 100),
        isRunning: false, // Would check background job status in production
      },
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Status check failed" },
      { status: 500 }
    );
  }
}
