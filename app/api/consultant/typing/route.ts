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
    // مهم: نجلب ui_state الحالي وندمجه حتى لا نمحي حقولًا حيوية مثل
    // takeover_active (التحكم اليدوي) أو حالة التجميد أو الذاكرة.
    const { data: existing } = await supabase
      .from("consultant_sessions")
      .select("ui_state")
      .eq("session_id", sessionId)
      .single();

    const currentUiState = (existing?.ui_state as Record<string, any> | null) || {};
    const { error } = await supabase
      .from("consultant_sessions")
      .update({
        ui_state: {
          ...currentUiState,
          typing_preview: typingPreview,
          last_typed_at: new Date().toISOString(),
        },
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
