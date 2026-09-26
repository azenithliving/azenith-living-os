/**
 * Agent Events Stream API (Server-Sent Events)
 * GET /api/admin/agents/events/stream
 * Real-time event stream for agent notifications
 */

import { NextRequest } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { SyncEvent } from "@/lib/ops/memory/SyncLayer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  // The server, rather than the caller, determines the company scope.
  const companyId = await resolveAdminCompanyId();
  if (!companyId) {
    return new Response("event: error\ndata: {\"message\":\"No company is configured\"}\n\n", {
      status: 503,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return new Response("event: error\ndata: {\"message\":\"Database client unavailable\"}\n\n", {
      status: 503,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  let closeStream = () => undefined;
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ company_id: companyId, mode: "live", timestamp: new Date().toISOString() })}\n\n`)
      );

      // ابدأ من آخر حدث موجود لحظة فتح الستريم — العرض للأحداث الجديدة فقط
      let lastId: number | null = null;
      try {
        const { data: newest } = await supabase
          .from("qayyim_sync_events")
          .select("id")
          .eq("company_id", companyId)
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (newest?.id != null) lastId = Number(newest.id);
      } catch {
        // الجدول مش متطبق لسه — الستريم يفضل شغال بالنبضات لحد ما يتطبق
      }

      const pollInterval = setInterval(async () => {
        if (closed) return;
        try {
          let query = supabase
            .from("qayyim_sync_events")
            .select("*")
            .eq("company_id", companyId)
            .order("created_at", { ascending: true })
            .limit(50);
          if (lastId != null) query = query.gt("id", lastId);

          const { data: events, error } = await query;
          if (error || !events) return; // صمت رشيق زي SyncLayer

          for (const event of events as SyncEvent[]) {
            if (closed) return;
            lastId = Number(event.id);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
        } catch {
          // صمت رشيق — الستريم ميعتمدش على سلامة كل استعلام
        }
      }, 3000);

      const heartbeatInterval = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${Date.now()}\n\n`));
      }, 30000);

      closeStream = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch { /* already closed */ }
      };
      request.signal.addEventListener("abort", closeStream, { once: true });
    },
    cancel() {
      closeStream();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
