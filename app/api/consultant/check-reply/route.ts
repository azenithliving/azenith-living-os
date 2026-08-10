import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * GET /api/consultant/check-reply?sessionId=xxx
 * Called by the widget to poll delivered admin answers.
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

    await supabase
      .from("consultant_pending_questions")
      .update({ status: "delivered" })
      .eq("id", data.id);

    const replyText =
      data.question === "DIRECT_MESSAGE"
        ? data.answered_reply
        : `رد الادارة على سؤالك:\n${data.answered_reply}`;

    return NextResponse.json({
      reply: replyText,
      source: data.question === "DIRECT_MESSAGE" ? "admin" : "admin_answer",
      question: data.question,
    });
  } catch (error) {
    console.error("[CheckReply] Error:", error);
    return NextResponse.json({ reply: null });
  }
}
