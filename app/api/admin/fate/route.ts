import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { sessionId, action, payload } = await request.json();

    if (!sessionId || !action) {
      return NextResponse.json({ error: "Missing sessionId or action" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    // سجل "أمر القدر" في جدول التحولات لكي يراه المتصفح فوراً
    const { error } = await supabase
      .from("reality_mutations")
      .insert({
        session_id: sessionId,
        type: "FATE_ACTION",
        action: action, // 'THUNDER', 'HALLUCINATION', 'FREEZE'
        payload: payload || {},
        active: true,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error("[Fate API] Error:", error);
      return NextResponse.json({ error: "Failed to trigger fate" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Fate action ${action} triggered.` });
  } catch (error) {
    console.error("[Fate API] Global Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
