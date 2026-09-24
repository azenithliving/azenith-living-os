/**
 * ────────────────────────────────────────────────────────────────────────────
 * API Route: /api/vanguard/memory/embed
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 2: Task 8 – Embedding generation and storage endpoint
 * 
 * POST /api/vanguard/memory/embed
 * Body: {
 *   entity_type: string;
 *   entity_id: string;
 *   content: string;
 *   metadata?: Record<string, unknown>;
 * }
 * 
 * Or batch:
 * Body: {
 *   batch: Array<{
 *     entity_type: string;
 *     entity_id: string;
 *     content: string;
 *     metadata?: Record<string, unknown>;
 *   }>;
 * }
 * 
 * Returns: {
 *   id: string;  // Single
 * } or {
 *   inserted: number;  // Batch
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { storeMemory, bulkStoreMemories } from "@/lib/vanguard/memory/semantic_memory_engine";
import { logger } from "@/lib/vanguard/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SingleEmbedRequest {
  entity_type: string;
  entity_id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface BatchEmbedRequest {
  batch: SingleEmbedRequest[];
}

type EmbedRequest = SingleEmbedRequest | BatchEmbedRequest;

function isBatchRequest(body: EmbedRequest): body is BatchEmbedRequest {
  return "batch" in body && Array.isArray(body.batch);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EmbedRequest;

    // Handle batch request
    if (isBatchRequest(body)) {
      if (!body.batch || body.batch.length === 0) {
        return NextResponse.json({ error: "Batch cannot be empty" }, { status: 400 });
      }

      // Validate each item
      for (let i = 0; i < body.batch.length; i++) {
        const item = body.batch[i];
        if (!item.entity_type || !item.entity_id || !item.content) {
          return NextResponse.json(
            { error: `Batch item ${i} missing required fields` },
            { status: 400 }
          );
        }
      }

      logger.info("[API] Bulk embedding storage", { count: body.batch.length });

      const result = await bulkStoreMemories(body.batch);

      if (!result.ok) {
        logger.error("[API] Bulk embed failed", { error: result.error.message });
        return NextResponse.json(
          { error: result.error.message, code: result.error.code },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        inserted: result.value,
      });
    }

    // Handle single request
    const singleBody = body as SingleEmbedRequest;

    // Validate required fields
    if (!singleBody.entity_type || !singleBody.entity_id || !singleBody.content) {
      return NextResponse.json(
        { error: "Missing required fields: entity_type, entity_id, content" },
        { status: 400 }
      );
    }

    if (singleBody.content.length < 10) {
      return NextResponse.json(
        { error: "Content must be at least 10 characters" },
        { status: 400 }
      );
    }

    logger.info("[API] Embedding storage", {
      entity_type: singleBody.entity_type,
      entity_id: singleBody.entity_id,
      contentLength: singleBody.content.length,
    });

    const result = await storeMemory({
      entity_type: singleBody.entity_type,
      entity_id: singleBody.entity_id,
      content: singleBody.content,
      metadata: singleBody.metadata,
    });

    if (!result.ok) {
      logger.error("[API] Embed failed", { error: result.error.message });
      return NextResponse.json(
        { error: result.error.message, code: result.error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: result.value.id,
      entity_type: result.value.entity_type,
      entity_id: result.value.entity_id,
    });
  } catch (error) {
    logger.error("[API] Unexpected error in /api/vanguard/memory/embed", { error });
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
    service: "vanguard-semantic-memory-embed",
    status: "operational",
    version: "2.0.0",
    supportedEntityTypes: [
      "material",
      "product",
      "learning",
      "memory",
      "lead",
      "belief",
      "document",
    ],
  });
}
