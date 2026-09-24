import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

// Using Edge runtime for infinite scale and zero cold-start latency
export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, path, hoveredElements, attentionScore } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Upsert telemetry data for this session
    // We try to update if it exists, otherwise insert
    const { data: existing } = await supabase
      .from("visitor_telemetry")
      .select("id")
      .eq("session_id", sessionId)
      .single();

    if (existing) {
      await supabase
        .from("visitor_telemetry")
        .update({
          current_path: path,
          hovered_elements: hoveredElements,
          attention_score: attentionScore,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("visitor_telemetry")
        .insert({
          session_id: sessionId,
          current_path: path,
          hovered_elements: hoveredElements,
          attention_score: attentionScore,
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Telemetry] Edge API Error:", error);
    // Return 200 even on error so we don't break the client with failed telemetry calls
    return NextResponse.json({ success: false, error: "Internal Error" });
  }
}
