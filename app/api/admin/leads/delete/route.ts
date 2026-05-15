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
    await supabase.from("visitor_telemetry").delete().in("session_id", sessionIds);

    // 2. Delete requests (which might have foreign keys to users)
    // First by request ID
    await supabase.from("requests").delete().in("id", sessionIds);
    
    // Then get user IDs associated with these sessions to delete their requests
    const { data: usersToCleanup } = await supabase
      .from("users")
      .select("id")
      .in("session_id", sessionIds);
    
    const userIds = (usersToCleanup || []).map(u => u.id);
    if (userIds.length > 0) {
      await supabase.from("requests").delete().in("user_id", userIds);
    }

    // 3. Delete consultant sessions
    await supabase.from("consultant_sessions").delete().in("session_id", sessionIds);
    await supabase.from("consultant_sessions").delete().in("id", sessionIds);

    // 4. Finally, delete users
    await supabase.from("users").delete().in("session_id", sessionIds);
    if (userIds.length > 0) {
      await supabase.from("users").delete().in("id", userIds);
    }

    return NextResponse.json({ success: true, deletedCount: sessionIds.length });
  } catch (error) {
    console.error("[Leads Delete] API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
