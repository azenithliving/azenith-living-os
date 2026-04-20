import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { sessionId, typingPreview } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    // تحديث معاينة الكتابة اللحظية في قاعدة البيانات
    const { error } = await supabase
      .from("consultant_sessions")
      .update({ 
        ui_state: { typing_preview: typingPreview, last_typed_at: new Date().toISOString() } 
      })
      .eq("session_id", sessionId);

    if (error) {
      return NextResponse.json({ error: "Failed to update typing state" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
