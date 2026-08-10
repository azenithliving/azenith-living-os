import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { sessionId, message } = await request.json();
    const cleanMessage = typeof message === "string" ? message.trim() : "";

    if (!sessionId || !cleanMessage) {
      return NextResponse.json({ error: "Missing sessionId or message" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { data: session, error: sessionErr } = await supabase
      .from("consultant_sessions")
      .select("messages, ui_state")
      .eq("session_id", sessionId)
      .single();

    if (sessionErr) {
      console.error("[AdminReply] Error fetching session:", sessionErr);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const updatedMessages = [
      ...(session.messages || []),
      {
        role: "assistant",
        content: cleanMessage,
        source: "admin",
        timestamp: new Date().toISOString(),
      },
    ];

    // Sending a manual reply automatically enters seamless takeover mode:
    // the AI stops answering so the human consultant drives the chat.
    const currentUiState = (session.ui_state as Record<string, any> | null) || {};
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("consultant_sessions")
      .update({
        messages: updatedMessages,
        ui_state: {
          ...currentUiState,
          takeover_active: true,
          takeover_started_at: currentUiState.takeover_started_at || now,
        },
        updated_at: now,
      })
      .eq("session_id", sessionId);

    if (updateErr) {
      console.error("[AdminReply] Error updating session:", updateErr);
      return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
    }

    await supabase.from("consultant_pending_questions").insert({
      session_id: sessionId,
      question: "DIRECT_MESSAGE",
      status: "answered",
      answered_reply: cleanMessage,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AdminReply] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
