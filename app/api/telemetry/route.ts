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

    // ── 1. Upsert visitor_telemetry (legacy table) ───────────────────────
    const { data: existing } = await supabase
      .from("visitor_telemetry")
      .select("id")
      .eq("session_id", sessionId)
      .single();

    if (existing) {
      await supabase
        .from("visitor_telemetry")
        .update({
          current_path:     path,
          hovered_elements: hoveredElements,
          attention_score:  attentionScore,
          updated_at:       new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("visitor_telemetry")
        .insert({
          session_id:       sessionId,
          current_path:     path,
          hovered_elements: hoveredElements,
          attention_score:  attentionScore,
        });
    }

    // ── 2. Write to qayyim_telemetry_events (Qayyim UX agent) ───────────
    const eventsToInsert: Array<Record<string, unknown>> = [];

    if (attentionScore > 0) {
      eventsToInsert.push({
        visitor_id:  sessionId,
        session_id:  sessionId,
        page_path:   path,
        section_key: (hoveredElements as string[] | undefined)?.[0] ?? "page",
        event_type:  "scroll_depth",
        event_value: Math.min(Math.round(attentionScore as number), 100),
        metadata:    { attention_score: attentionScore },
      });
    }

    for (const elem of ((hoveredElements as string[] | undefined) ?? []).slice(0, 3)) {
      eventsToInsert.push({
        visitor_id:  sessionId,
        session_id:  sessionId,
        page_path:   path,
        section_key: elem,
        event_type:  "hover",
        event_value: 1,
        metadata:    { element: elem },
      });
    }

    if (eventsToInsert.length > 0) {
      // fire-and-forget — Edge runtime compatible
      void supabase.from("qayyim_telemetry_events").insert(eventsToInsert);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Telemetry] Edge API Error:", error);
    return NextResponse.json({ success: false, error: "Internal Error" });
  }
}
