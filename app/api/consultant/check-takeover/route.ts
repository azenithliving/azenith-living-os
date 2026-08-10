import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * GET /api/consultant/check-takeover?sessionId=xxx
 * Lightweight endpoint to check if takeover is active for a session.
 * Called by widget every 2s when chat is open.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ takeover_active: false });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ takeover_active: false });
    }

    const { data: session, error } = await supabase
      .from("consultant_sessions")
      .select("ui_state")
      .eq("session_id", sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json({ takeover_active: false });
    }

    const uiState = (session.ui_state as Record<string, any> | null) || {};
    const takeoverActive = uiState.takeover_active === true;

    return NextResponse.json({ 
      takeover_active: takeoverActive,
      takeover_started_at: uiState.takeover_started_at || null
    });
  } catch (error) {
    console.error("[CheckTakeover] Error:", error);
    return NextResponse.json({ takeover_active: false });
  }
}