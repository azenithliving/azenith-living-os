import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log("[Fate API] Starting fate trigger request...");
  try {
    const body = await request.json();
    const { sessionId, action, payload } = body;

    console.log("[Fate API] Request params:", { sessionId, action, hasPayload: !!payload });

    if (!sessionId || !action) {
      console.error("[Fate API] Missing required params");
      return NextResponse.json({ error: "Missing sessionId or action" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      console.error("[Fate API] Supabase Admin Client failed to initialize");
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    // سجل "أمر القدر" في جدول التحولات لكي يراه المتصفح فوراً
    console.log("[Fate API] Inserting into reality_mutations...");
    const { data, error } = await supabase
      .from("reality_mutations")
      .insert({
        session_id: sessionId,
        type: "FATE_ACTION",
        action: action, 
        payload: payload || {},
        active: true,
        created_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error("[Fate API] Database Error Details:", error);
      // إذا كان الجدول مفقوداً، سنحاول إرجاع رسالة واضحة
      if (error.code === '42P01') {
        return NextResponse.json({ error: "Database table 'reality_mutations' missing. Run migration." }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[Fate API] Fate triggered successfully:", data);
    return NextResponse.json({ success: true, message: `Fate action ${action} triggered.` });
  } catch (error: any) {
    console.error("[Fate API] Global Catch Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
