/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – Embedding Service
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 2: Task 2 – HuggingFace embedding generation with rate limiting
 * 
 * Generates 768-dimensional embeddings using HuggingFace Inference API.
 * Model: sentence-transformers/all-MiniLM-L6-v2 (free tier compatible)
 * 
 * Features:
 * - Automatic rate limiting (respects API_CONFIGS.huggingface)
 * - Batch embedding support
 * - Caching via cache_manager.ts
 * - Fallback to empty vector on failure
 */

import { logger } from "@/lib/vanguard/observability/logger";
import { rateLimiter } from "@/lib/vanguard/observability/rate_limiter";
import { cacheManager } from "@/lib/vanguard/observability/cache_manager";
import type { Result, VanguardError } from "@/lib/vanguard/types";
import { Ok, Err, makeError } from "@/lib/vanguard/types";

// ─── Configuration ───────────────────────────────────────────────────────────

const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"; // 768 dims
const EMBEDDING_DIM = 768;
const MAX_TEXT_LENGTH = 512; // tokens (model limit)
const BATCH_SIZE = 32; // HuggingFace free tier limit

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
  dimensions: number;
  cached: boolean;
}

export interface BatchEmbeddingResult {
  results: EmbeddingResult[];
  totalProcessed: number;
  errors: Array<{ text: string; error: string }>;
}

// ─── Helper: Truncate Text ──────────────────────────────────────────────────

function truncateText(text: string): string {
  // Simple token approximation: ~4 chars per token
  const maxChars = MAX_TEXT_LENGTH * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "...";
}

// ─── Helper: Generate Cache Key ──────────────────────────────────────────────

function getCacheKey(text: string, model: string): string {
  // Use first 100 chars + model as cache key (avoid huge keys)
  const textHash = text.slice(0, 100).replace(/\s+/g, "_");
  return `embedding:${model}:${textHash}`;
}

// ─── Main: Generate Single Embedding ─────────────────────────────────────────

export async function generateEmbedding(
  text: string,
  options?: {
    skipCache?: boolean;
    model?: string;
  }
): Promise<Result<EmbeddingResult, VanguardError>> {
  const model = options?.model || EMBEDDING_MODEL;
  const truncated = truncateText(text);

  // Check cache first (unless skipped)
  if (!options?.skipCache) {
    const cacheKey = getCacheKey(truncated, model);
    const cached = await cacheManager.get<number[]>(cacheKey);
    if (cached) {
      logger.debug("[EmbeddingService] Cache hit", { textLength: text.length });
      return Ok({
        text: truncated,
        embedding: cached,
        model,
        dimensions: cached.length,
        cached: true,
      });
    }
  }

  // Rate limit check
  const canProceed = await rateLimiter.waitAndCheck("huggingface");
  if (!canProceed) {
    return Err(
      makeError("RATE_LIMIT_EXCEEDED", "HuggingFace API rate limit exceeded", {
        service: "huggingface",
        model,
      })
    );
  }

  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      return Err(
        makeError("CONFIG_MISSING", "HUGGINGFACE_API_KEY not configured", {
          required: "HUGGINGFACE_API_KEY",
        })
      );
    }

    logger.debug("[EmbeddingService] Generating embedding", {
      model,
      textLength: truncated.length,
    });

    const response = await fetch(
      `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: truncated,
          options: { wait_for_model: true },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("[EmbeddingService] HuggingFace API error", {
        status: response.status,
        error: errorText,
      });

      // Handle rate limit (429) specifically
      if (response.status === 429) {
        await rateLimiter.handleRateLimitResponse("huggingface", response.headers);
        return Err(
          makeError("RATE_LIMIT_EXCEEDED", "HuggingFace rate limit hit", {
            retryAfter: response.headers.get("retry-after"),
          })
        );
      }

      return Err(
        makeError("EMBEDDING_GENERATION_FAILED", `HuggingFace API error: ${response.status}`, {
          status: response.status,
          error: errorText,
        })
      );
    }

    const embedding = (await response.json()) as number[];

    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
      return Err(
        makeError("INVALID_EMBEDDING", `Expected ${EMBEDDING_DIM}-dim array, got ${typeof embedding}`, {
          received: Array.isArray(embedding) ? embedding.length : typeof embedding,
        })
      );
    }

    // Cache the result
    const cacheKey = getCacheKey(truncated, model);
    await cacheManager.set(cacheKey, embedding, cacheManager.ttl("embedding"));

    logger.info("[EmbeddingService] Embedding generated", {
      textLength: truncated.length,
      dimensions: embedding.length,
    });

    return Ok({
      text: truncated,
      embedding,
      model,
      dimensions: embedding.length,
      cached: false,
    });
  } catch (error) {
    logger.error("[EmbeddingService] Unexpected error", { error });
    return Err(
      makeError("EMBEDDING_SERVICE_ERROR", "Failed to generate embedding", {
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

// ─── Batch: Generate Multiple Embeddings ─────────────────────────────────────

export async function generateBatchEmbeddings(
  texts: string[],
  options?: {
    skipCache?: boolean;
    model?: string;
  }
): Promise<BatchEmbeddingResult> {
  const results: EmbeddingResult[] = [];
  const errors: Array<{ text: string; error: string }> = [];

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    for (const text of batch) {
      const result = await generateEmbedding(text, options);
      if (result.ok) {
        results.push(result.value);
      } else {
        errors.push({
          text: text.slice(0, 50) + "...",
          error: result.error.message,
        });
        logger.warn("[EmbeddingService] Batch embedding failed", {
          text: text.slice(0, 50),
          error: result.error.code,
        });
      }
    }

    // Small delay between batches to avoid overwhelming API
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  logger.info("[EmbeddingService] Batch embedding complete", {
    total: texts.length,
    successful: results.length,
    failed: errors.length,
  });

  return {
    results,
    totalProcessed: texts.length,
    errors,
  };
}

// ─── Helper: Create Empty Embedding (Fallback) ───────────────────────────────

export function createEmptyEmbedding(): number[] {
  return new Array(EMBEDDING_DIM).fill(0);
}

// ─── Helper: Cosine Similarity ───────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Helper: Get Embedding Dimensions ─────────────────────────────────────────

export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIM;
}

// ─── Helper: Validate Embedding ──────────────────────────────────────────────

export function validateEmbedding(embedding: unknown): embedding is number[] {
  return (
    Array.isArray(embedding) &&
    embedding.length === EMBEDDING_DIM &&
    embedding.every((n) => typeof n === "number" && !isNaN(n))
  );
}
