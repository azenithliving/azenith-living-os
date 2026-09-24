/**
 * ────────────────────────────────────────────────────────────────────────────
 * API Route: /api/vanguard/memory/search
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 2: Task 7 – Semantic memory search endpoint
 * 
 * POST /api/vanguard/memory/search
 * Body: {
 *   query: string;
 *   entityTypes?: string[];
 *   limit?: number;
 *   threshold?: number;
 *   contextDomain?: string;
 *   rerank?: boolean;
 *   minFinalScore?: number;
 * }
 * 
 * Returns: {
 *   results: RankedResult[];
 *   totalFound: number;
 *   query: string;
 *   executionTimeMs: number;
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { searchMemory } from "@/lib/vanguard/memory/semantic_memory_engine";
import { logger } from "@/lib/vanguard/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SearchRequest {
  query: string;
  entityTypes?: string[];
  limit?: number;
  threshold?: number;
  contextDomain?: string;
  rerank?: boolean;
  minFinalScore?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SearchRequest;

    // Validate required fields
    if (!body.query || typeof body.query !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'query' field" },
        { status: 400 }
      );
    }

    if (body.query.length < 3) {
      return NextResponse.json(
        { error: "Query must be at least 3 characters" },
        { status: 400 }
      );
    }

    logger.info("[API] Semantic memory search", {
      query: body.query,
      entityTypes: body.entityTypes,
      limit: body.limit,
    });

    // Execute search
    const result = await searchMemory({
      query: body.query,
      entityTypes: body.entityTypes,
      limit: body.limit || 10,
      threshold: body.threshold,
      contextDomain: body.contextDomain,
      rerank: body.rerank,
      minFinalScore: body.minFinalScore,
    });

    if (!result.ok) {
      logger.error("[API] Search failed", { error: result.error.message });
      return NextResponse.json(
        {
          error: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    logger.error("[API] Unexpected error in /api/vanguard/memory/search", { error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET: Health check
export async function GET() {
  return NextResponse.json({
    service: "vanguard-semantic-memory-search",
    status: "operational",
    version: "2.0.0",
  });
}
