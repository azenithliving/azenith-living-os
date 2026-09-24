/**
 * ────────────────────────────────────────────────────────────────────────────
 * API Route: /api/channels/websocket
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 3: Task 9 – WebSocket server endpoint
 * 
 * Note: Next.js App Router doesn't natively support WebSocket servers.
 * This endpoint provides information about WebSocket connection.
 * 
 * For production WebSocket support, use one of these approaches:
 * 1. Socket.io with custom server (see server.ts)
 * 2. Pusher/Ably for managed WebSocket service
 * 3. Separate WebSocket server (Node.js standalone)
 * 4. Vercel's Edge Functions with WebSocket support (experimental)
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/vanguard/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── GET: WebSocket Information ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const protocol = request.nextUrl.protocol === "https:" ? "wss:" : "ws:";
  const host = request.headers.get("host") || "localhost:3000";

  return NextResponse.json({
    service: "vanguard-websocket",
    status: "info",
    message: "WebSocket server requires custom setup. See documentation for Socket.io integration.",
    websocketUrl: `${protocol}//${host}/socket`,
    documentation: {
      approach1: {
        name: "Socket.io with custom server",
        description: "Create server.ts with Socket.io and run alongside Next.js",
        example: "See lib/vanguard/channels/websocket_server.ts",
      },
      approach2: {
        name: "Managed service (Pusher/Ably)",
        description: "Use third-party service for production-grade WebSocket",
        recommendation: "Best for serverless deployments",
      },
      approach3: {
        name: "Standalone WebSocket server",
        description: "Run separate Node.js WebSocket server",
        ports: "Next.js: 3000, WebSocket: 3001",
      },
    },
  });
}

// ── POST: Not Supported ──────────────────────────────────────────────────────

export async function POST() {
  return NextResponse.json(
    {
      error: "WebSocket connections require Socket.io or similar library",
      message: "Use GET for connection information",
    },
    { status: 405 }
  );
}
