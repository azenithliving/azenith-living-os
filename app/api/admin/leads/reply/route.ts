import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { sessionId, message } = await request.json();

    if (!sessionId || !message) {
      return NextResponse.json({ error: "Missing sessionId or message" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    // 1. Fetch current session to update history
    const { data: session, error: sessionErr } = await supabase
      .from("consultant_sessions")
      .select("messages")
      .eq("session_id", sessionId)
      .single();

    if (sessionErr) {
      console.error("[AdminReply] Error fetching session:", sessionErr);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const updatedMessages = [
      ...(session.messages || []),
      { role: "assistant", content: `👨‍💼 [تدخل الإدارة]: ${message}`, timestamp: new Date().toISOString() }
    ];

    // 2. Update session messages
    await supabase
      .from("consultant_sessions")
      .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
      .eq("session_id", sessionId);

    // 3. Add to pending questions as answered so the widget picks it up immediately via polling
    await supabase.from("consultant_pending_questions").insert({
      session_id: sessionId,
      question: "DIRECT_MESSAGE",
      status: "answered",
      answered_reply: message
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AdminReply] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
