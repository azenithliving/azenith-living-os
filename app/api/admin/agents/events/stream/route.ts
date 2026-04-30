/**
 * Agent Events Stream API (Server-Sent Events)
 * GET /api/admin/agents/events/stream
 * Real-time event stream for agent notifications
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');

  if (!companyId) {
    return NextResponse.json(
      { success: false, error: 'company_id required' },
      { status: 400 }
    );
  }

  // Create a new ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ company_id: companyId, timestamp: new Date().toISOString() })}\n\n`)
      );

      // Keep connection alive with heartbeat
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Simulate event push (in production, this would come from Supabase realtime or Redis)
      const eventInterval = setInterval(() => {
        try {
          const mockEvent = {
            type: ['task_completed', 'device_online', 'approval_needed', 'task_stuck'][Math.floor(Math.random() * 4)],
            timestamp: new Date().toISOString(),
            data: {
              company_id: companyId,
              message: 'New event from agent system'
            }
          };
          controller.enqueue(
            encoder.encode(`event: agent_event\ndata: ${JSON.stringify(mockEvent)}\n\n`)
          );
        } catch {
          clearInterval(eventInterval);
          clearInterval(heartbeatInterval);
        }
      }, 10000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        clearInterval(eventInterval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
