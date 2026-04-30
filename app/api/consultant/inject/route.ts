import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * POST /api/consultant/inject
 * يحقن رسالة كـ "assistant" مباشرة في سجل المحادثة (Supabase)
 * يُستدعى عند:
 * 1. فتح الشات بعد التجميد (رسالة العرض الخاص)
 * 2. رد الأدمن المباشر من الداشبورد
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { sessionId, message, source = "fate" } = await request.json();

    if (!sessionId || !message) {
      return NextResponse.json({ error: "Missing sessionId or message" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "DB not available" }, { status: 500 });
    }

    // جلب الجلسة الحالية
    const { data: session, error: fetchError } = await supabase
      .from("consultant_sessions")
      .select("messages")
      .eq("session_id", sessionId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const existingMessages = session?.messages || [];

    // بناء الرسالة المحقونة مع prefix يخبر المستشار بالمصدر
    const prefix = source === "admin" ? "[رسالة من الإدارة]: " : "[عرض خاص من الإدارة]: ";
    const injectedMessage = {
      role: "assistant" as const,
      content: `${prefix}${message}`,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...existingMessages, injectedMessage];

    if (session) {
      // تحديث الجلسة الموجودة
      await supabase
        .from("consultant_sessions")
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq("session_id", sessionId);
    } else {
      // إنشاء جلسة جديدة
      await supabase.from("consultant_sessions").insert({
        session_id: sessionId,
        messages: updatedMessages,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    console.log(`[Inject API] Injected ${source} message into session ${sessionId}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Inject API] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
