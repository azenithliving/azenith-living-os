import { SovereignIntelligenceKernel } from "@/lib/sovereign-kernel";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * THE SOVEREIGN PULSE
 * Streaming the Event Horizon of the Unified Intelligence
 */
export async function GET() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Missing database connection" }), { status: 500 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // 1. Initial snapshot of recent events
      const { data: initialEvents } = await supabase
        .from("sovereign_event_horizon")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (initialEvents) {
        sendEvent({ type: "history", events: initialEvents });
      }

      // 2. Real-time subscription to the Event Horizon
      const subscription = supabase
        .channel("event_horizon_pulse")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "sovereign_event_horizon" },
          (payload) => {
            sendEvent({ type: "new_event", event: payload.new });
          }
        )
        .subscribe();

      // Keep connection alive
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 15000);

      // Cleanup
      // controller.close() would be called when the client disconnects, 
      // but in Next.js Edge/Serverless, we handle this via request cancellation
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

/**
 * POST - Execute Command via Kernel
 */
export async function POST(req: Request) {
  try {
    const { command, userId } = await req.json();
    if (!command) {
      return Response.json({ success: false, error: "Missing command" }, { status: 400 });
    }

    const kernel = SovereignIntelligenceKernel.getInstance();
    const result = await kernel.processIntent(command, userId);

    return Response.json({
      success: true,
      message: result,
    });
  } catch (error) {
    console.error("[SovereignPulse] POST error:", error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
