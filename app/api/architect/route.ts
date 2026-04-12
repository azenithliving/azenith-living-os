/**
 * The Supreme Architect API - Command Horizon Backend
 * 
 * Endpoints:
 * - POST /api/architect/chat - Main chat interface
 * - POST /api/architect/action - Execute actions (apply code, etc.)
 * - GET /api/architect/status - System status for greeting
 * - GET /api/architect/codebase - Codebase overview
 */

import { NextRequest, NextResponse } from "next/server";
import {
  processArchitectMessage,
  generateImperialGreeting,
  getCodebaseOverview,
  getSystemStatus
} from "@/lib/supreme-architect";
import { rateLimiter, getClientIP } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Rate limit check helper
async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const ip = getClientIP(request);
  const { success, limit, remaining, reset } = await rateLimiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      {
        success: false,
        error: "Rate limit exceeded",
        limit,
        remaining,
        reset,
      },
      { status: 429 }
    );
  }
  return null;
}

/**
 * POST /api/architect/chat
 * Main chat interface with the Supreme Architect
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResponse = await checkRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { message, sessionId, userId, attachments } = body;

    if (!message || !sessionId) {
      return NextResponse.json(
        { success: false, error: "Missing message or sessionId" },
        { status: 400 }
      );
    }

    const response = await processArchitectMessage(
      message,
      sessionId,
      userId,
      attachments,
    );

    return NextResponse.json({ success: true, response });
  } catch (error) {
    console.error("[Architect API] Chat error:", error);
    return NextResponse.json(
      { success: false, error: "Architect processing failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/architect/status
 * Get imperial status report for greeting
 */
export async function GET(request: NextRequest) {
  // Check rate limit
  const rateLimitResponse = await checkRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  try {
    if (type === "greeting") {
      const greeting = await generateImperialGreeting();
      return NextResponse.json({ success: true, greeting });
    }

    if (type === "codebase") {
      const overview = await getCodebaseOverview();
      return NextResponse.json({ success: true, overview });
    }

    // Default: system status
    const status = await getSystemStatus();
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("[Architect API] Status error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}
