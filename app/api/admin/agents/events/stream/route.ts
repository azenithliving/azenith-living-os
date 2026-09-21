/**
 * Agent Events Stream API (Server-Sent Events)
 * GET /api/admin/agents/events/stream
 * Real-time event stream for agent notifications
 */

import { NextRequest } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { resolveAdminCompanyId } from "@/lib/admin-company";

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

  let closeStream = () => undefined;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ company_id: companyId, mode: "heartbeat_only", timestamp: new Date().toISOString() })}\n\n`)
      );

      const heartbeatInterval = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${Date.now()}\n\n`));
      }, 30000);

      closeStream = () => {
        if (closed) return;
        closed = true;
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
