import { NextResponse } from "next/server";
import { getOrchestratorHealth } from "@/lib/ai-orchestrator";
import { createClient } from "@/utils/supabase/server";

/**
 * AI Health API - Reports key pool status to the dashboard
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Security check: Only authenticated admins (placeholder check, assuming auth middleware handles redirect)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pools = await getOrchestratorHealth();

    return NextResponse.json({
      ok: true,
      pools,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[AIHealthAPI] Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch AI health" }, { status: 500 });
  }
}
