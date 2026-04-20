import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { sessionIds } = await request.json();

    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ error: "Missing sessionIds" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    // 1. Delete telemetry data
    const { error: telError } = await supabase
      .from("visitor_telemetry")
      .delete()
      .in("session_id", sessionIds);

    if (telError) {
      console.error("[Leads Delete] Telemetry error:", telError);
    }

    // 2. Delete consultant sessions
    const { error: sessError } = await supabase
      .from("consultant_sessions")
      .delete()
      .in("session_id", sessionIds);

    if (sessError) {
      console.error("[Leads Delete] Session error:", sessError);
      return NextResponse.json({ error: "Failed to delete sessions" }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedCount: sessionIds.length });
  } catch (error) {
    console.error("[Leads Delete] API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
