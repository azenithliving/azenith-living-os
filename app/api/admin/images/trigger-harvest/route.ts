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

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const REPO_OWNER = "azenithliving";
    const REPO_NAME = "azenith-living-os";
    const WORKFLOW_ID = "run-harvester.yml";

    if (!GITHUB_TOKEN) {
      console.error("[Trigger Harvest] GITHUB_TOKEN is missing in env vars");
      return NextResponse.json(
        { success: false, error: "GitHub configuration missing" },
        { status: 500 }
      );
    }

    // Trigger GitHub Action via workflow_dispatch
    const ghResponse = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main", // or the active branch
        }),
      }
    );

    if (!ghResponse.ok) {
      const errorText = await ghResponse.text();
      throw new Error(`GitHub API error: ${ghResponse.status} - ${errorText}`);
    }

    console.log(`[Admin Harvest] GitHub Workflow Triggered successfully`);
    
    return NextResponse.json({
      success: true,
      message: "Harvest triggered on GitHub Actions",
      details: {
        target: targetCount,
        force,
        platform: "GitHub Actions",
        status: "queued/running",
      },
    });

  } catch (error: any) {
    console.error("[Trigger Harvest API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to trigger harvest" },
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
