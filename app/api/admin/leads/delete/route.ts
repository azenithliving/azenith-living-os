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

    // 1. Delete telemetry data by session_id
    await supabase.from("visitor_telemetry").delete().in("session_id", sessionIds);
    // 2. Delete telemetry data by id (in case it was passed as id)
    await supabase.from("visitor_telemetry").delete().in("id", sessionIds);

    // 3. Delete consultant sessions by session_id
    const { error: sessError1 } = await supabase
      .from("consultant_sessions")
      .delete()
      .in("session_id", sessionIds);

    // 4. Delete consultant sessions by id
    const { error: sessError2 } = await supabase
      .from("consultant_sessions")
      .delete()
      .in("id", sessionIds);

    if (sessError1 && sessError2) {
      console.error("[Leads Delete] Session errors:", sessError1, sessError2);
      return NextResponse.json({ error: "Failed to delete sessions from all identifiers" }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedCount: sessionIds.length });
  } catch (error) {
    console.error("[Leads Delete] API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
