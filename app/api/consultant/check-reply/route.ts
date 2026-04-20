import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * GET /api/consultant/check-reply?sessionId=xxx
 * Called by the widget to check if admin has answered a pending question for this session
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ reply: null });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ reply: null });

    // Look for answered questions for this session
    const { data, error } = await supabase
      .from("consultant_pending_questions")
      .select("id, question, answered_reply")
      .eq("session_id", sessionId)
      .eq("status", "answered")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data || !data.answered_reply) {
      return NextResponse.json({ reply: null });
    }

    // Mark as delivered so we don't send again
    await supabase
      .from("consultant_pending_questions")
      .update({ status: "delivered" })
      .eq("id", data.id);

    const replyText = data.question === "DIRECT_MESSAGE" 
        ? `👨‍💼 من الإدارة:\n${data.answered_reply}`
        : `✅ رد الإدارة على سؤالك:\n${data.answered_reply}`;

    return NextResponse.json({
      reply: replyText,
      question: data.question,
    });
  } catch (error) {
    console.error("[CheckReply] Error:", error);
    return NextResponse.json({ reply: null });
  }
}
