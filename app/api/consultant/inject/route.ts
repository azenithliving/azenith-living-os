import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * POST /api/consultant/inject
 * Injects a clean assistant-visible message into a consultant session.
 * The source is stored separately so the client UI stays seamless.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { sessionId, message, source = "fate" } = await request.json();
    const cleanMessage = typeof message === "string" ? message.trim() : "";

    if (!sessionId || !cleanMessage) {
      return NextResponse.json({ error: "Missing sessionId or message" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "DB not available" }, { status: 500 });
    }

    const { data: session, error: fetchError } = await supabase
      .from("consultant_sessions")
      .select("messages")
      .eq("session_id", sessionId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const injectedMessage = {
      role: "assistant" as const,
      content: cleanMessage,
      source: String(source || "fate"),
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...(session?.messages || []), injectedMessage];
    const now = new Date().toISOString();

    if (session) {
      const { error } = await supabase
        .from("consultant_sessions")
        .update({ messages: updatedMessages, updated_at: now })
        .eq("session_id", sessionId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase.from("consultant_sessions").insert({
        session_id: sessionId,
        messages: updatedMessages,
        created_at: now,
        updated_at: now,
      });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[Inject API] Injected ${source} message into session ${sessionId}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Inject API] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
