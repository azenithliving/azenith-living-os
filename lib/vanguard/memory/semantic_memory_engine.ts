/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – Semantic Memory Engine
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 2: Task 1 – Hybrid search coordinator
 * 
 * Main interface for semantic memory operations:
 * - Store: Generate embedding + insert to vector store
 * - Search: Query → embed → vector search → rerank
 * - Update: Regenerate embedding + update vector store
 * - Delete: Remove from vector store
 * 
 * Architecture:
 * ┌──────────────────────────────────────────────┐
 * │  Semantic Memory Engine (Coordinator)        │
 * └──────────────────────────────────────────────┘
 *          │
 *          ├─→ embedding_service.ts (HuggingFace)
 *          ├─→ vector_store.ts (pgvector CRUD)
 *          └─→ reranker.ts (post-retrieval scoring)
 */

import { logger } from "@/lib/vanguard/observability/logger";
import type { Result, VanguardError } from "@/lib/vanguard/types";
import { Ok, Err, makeError } from "@/lib/vanguard/types";
import {
  generateEmbedding,
  generateBatchEmbeddings,
  type EmbeddingResult,
} from "./embedding_service";
import {
  insertEmbedding,
  updateEmbedding,
  deleteEmbedding,
  searchEmbeddings,
  getEmbeddingsByEntity,
  bulkInsertEmbeddings,
  type VectorRecord,
  type VectorSearchResult,
} from "./vector_store";
import {
  rerankResults,
  filterByMinScore,
  getTopN,
  serializeRankedResults,
  type RankedResult,
  type RerankOptions,
} from "./reranker";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StoreMemoryRequest {
  entity_type: string;
  entity_id: string;
  content: string;
  metadata?: Record<string, unknown>;
  skipEmbedding?: boolean; // If already embedded, provide embedding directly
  embedding?: number[];
}

export interface SearchMemoryRequest {
  query: string;
  entityTypes?: string[];
  limit?: number;
  threshold?: number;
  contextDomain?: string;
  rerank?: boolean; // Enable reranking (default: true)
  minFinalScore?: number; // Filter reranked results by minimum score
}

export interface SearchMemoryResponse {
  results: RankedResult[];
  totalFound: number;
  query: string;
  executionTimeMs: number;
}

// ─── Store: Add Memory with Embedding ────────────────────────────────────────

export async function storeMemory(
  request: StoreMemoryRequest
): Promise<Result<VectorRecord, VanguardError>> {
  const startTime = Date.now();

  logger.info("[SemanticMemory] Storing memory", {
    entity_type: request.entity_type,
    entity_id: request.entity_id,
    contentLength: request.content.length,
  });

  try {
    let embedding: number[];

    if (request.skipEmbedding && request.embedding) {
      embedding = request.embedding;
      logger.debug("[SemanticMemory] Using provided embedding");
    } else {
      // Generate embedding
      const embeddingResult = await generateEmbedding(request.content);
      if (!embeddingResult.ok) {
        return Err(embeddingResult.error);
      }
      embedding = embeddingResult.value.embedding;
    }

    // Insert to vector store
    const insertResult = await insertEmbedding({
      entity_type: request.entity_type,
      entity_id: request.entity_id,
      content: request.content,
      embedding,
      metadata: request.metadata,
    });

    if (!insertResult.ok) {
      return Err(insertResult.error);
    }

    const duration = Date.now() - startTime;
    logger.info("[SemanticMemory] Memory stored successfully", {
      id: insertResult.value.id,
      durationMs: duration,
    });

    return Ok(insertResult.value);
  } catch (error) {
    logger.error("[SemanticMemory] Store failed", { error });
    return Err(
      makeError("SEMANTIC_MEMORY_STORE_FAILED", "Failed to store memory", {
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

// ─── Search: Hybrid Search with Reranking ────────────────────────────────────

export async function searchMemory(
  request: SearchMemoryRequest
): Promise<Result<SearchMemoryResponse, VanguardError>> {
  const startTime = Date.now();

  logger.info("[SemanticMemory] Searching memory", {
    query: request.query,
    entityTypes: request.entityTypes,
    limit: request.limit,
  });

  try {
    // Step 1: Generate query embedding
    const embeddingResult = await generateEmbedding(request.query);
    if (!embeddingResult.ok) {
      return Err(embeddingResult.error);
    }

    const queryEmbedding = embeddingResult.value.embedding;

    // Step 2: Vector search
    const searchResult = await searchEmbeddings({
      query: request.query,
      queryEmbedding,
      entityTypes: request.entityTypes,
      limit: request.limit || 20, // Fetch more for reranking
      threshold: request.threshold || 0.5,
    });

    if (!searchResult.ok) {
      return Err(searchResult.error);
    }

    let results = searchResult.value;

    // Step 3: Rerank (if enabled)
    const enableRerank = request.rerank !== false;
    let rankedResults: RankedResult[];

    if (enableRerank && results.length > 0) {
      const rerankOptions: RerankOptions = {
        query: request.query,
        contextDomain: request.contextDomain,
      };

      rankedResults = rerankResults(results, rerankOptions);

      // Filter by minimum score (if specified)
      if (request.minFinalScore !== undefined) {
        rankedResults = filterByMinScore(rankedResults, request.minFinalScore);
      }

      // Limit to requested count
      rankedResults = getTopN(rankedResults, request.limit || 10);

      logger.debug("[SemanticMemory] Reranking applied", {
        beforeCount: results.length,
        afterCount: rankedResults.length,
      });
    } else {
      // No reranking, convert to RankedResult format
      rankedResults = results.slice(0, request.limit || 10).map((r) => ({
        ...r,
        finalScore: r.similarity,
        scoreBreakdown: {
          similarity: r.similarity,
          recency: 0,
          domain: 0,
          entityType: 0,
          keyword: 0,
        },
      }));
    }

    const duration = Date.now() - startTime;

    logger.info("[SemanticMemory] Search complete", {
      query: request.query,
      resultsCount: rankedResults.length,
      durationMs: duration,
    });

    logger.debug("[SemanticMemory] Top results:\n" + serializeRankedResults(rankedResults));

    return Ok({
      results: rankedResults,
      totalFound: rankedResults.length,
      query: request.query,
      executionTimeMs: duration,
    });
  } catch (error) {
    logger.error("[SemanticMemory] Search failed", { error });
    return Err(
      makeError("SEMANTIC_MEMORY_SEARCH_FAILED", "Failed to search memory", {
        query: request.query,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

// ─── Update: Regenerate Embedding and Update ──────────────────────────────────

export async function updateMemory(
  id: string,
  updates: {
    content?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<Result<VectorRecord, VanguardError>> {
  logger.info("[SemanticMemory] Updating memory", { id });

  try {
    let embedding: number[] | undefined;

    // If content changed, regenerate embedding
    if (updates.content) {
      const embeddingResult = await generateEmbedding(updates.content);
      if (!embeddingResult.ok) {
        return Err(embeddingResult.error);
      }
      embedding = embeddingResult.value.embedding;
    }

    // Update vector store
    const updateResult = await updateEmbedding(id, {
      content: updates.content,
      embedding,
      metadata: updates.metadata,
    });

    if (!updateResult.ok) {
      return Err(updateResult.error);
    }

    logger.info("[SemanticMemory] Memory updated", { id });
    return Ok(updateResult.value);
  } catch (error) {
    logger.error("[SemanticMemory] Update failed", { id, error });
    return Err(
      makeError("SEMANTIC_MEMORY_UPDATE_FAILED", "Failed to update memory", {
        id,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

// ─── Delete: Remove Memory ────────────────────────────────────────────────────

export async function deleteMemory(id: string): Promise<Result<void, VanguardError>> {
  logger.info("[SemanticMemory] Deleting memory", { id });

  const result = await deleteEmbedding(id);

  if (result.ok) {
    logger.info("[SemanticMemory] Memory deleted", { id });
  } else {
    logger.error("[SemanticMemory] Delete failed", { id, error: result.error.message });
  }

  return result;
}

// ─── Get Memories by Entity ───────────────────────────────────────────────────

export async function getMemoriesByEntity(
  entity_type: string,
  entity_id: string
): Promise<Result<VectorRecord[], VanguardError>> {
  logger.debug("[SemanticMemory] Fetching memories by entity", { entity_type, entity_id });

  const result = await getEmbeddingsByEntity(entity_type, entity_id);

  if (result.ok) {
    logger.debug("[SemanticMemory] Memories fetched", {
      entity_type,
      entity_id,
      count: result.value.length,
    });
  }

  return result;
}

// ─── Bulk Store: Batch Insert Memories ────────────────────────────────────────

export async function bulkStoreMemories(
  requests: StoreMemoryRequest[]
): Promise<Result<number, VanguardError>> {
  const startTime = Date.now();

  logger.info("[SemanticMemory] Bulk storing memories", { count: requests.length });

  try {
    // Generate embeddings in batch
    const textsToEmbed = requests
      .filter((r) => !r.skipEmbedding)
      .map((r) => r.content);

    const batchEmbeddings = await generateBatchEmbeddings(textsToEmbed);

    // Map embeddings back to requests
    let embeddingIndex = 0;
    const recordsWithEmbeddings = requests.map((req) => {
      let embedding: number[];

      if (req.skipEmbedding && req.embedding) {
        embedding = req.embedding;
      } else {
        const embeddingResult = batchEmbeddings.results[embeddingIndex];
        if (!embeddingResult) {
          throw new Error(`Missing embedding for request ${embeddingIndex}`);
        }
        embedding = embeddingResult.embedding;
        embeddingIndex++;
      }

      return {
        entity_type: req.entity_type,
        entity_id: req.entity_id,
        content: req.content,
        embedding,
        metadata: req.metadata,
      };
    });

    // Bulk insert
    const insertResult = await bulkInsertEmbeddings(recordsWithEmbeddings);

    if (!insertResult.ok) {
      return Err(insertResult.error);
    }

    const duration = Date.now() - startTime;
    logger.info("[SemanticMemory] Bulk store complete", {
      inserted: insertResult.value,
      durationMs: duration,
    });

    return Ok(insertResult.value);
  } catch (error) {
    logger.error("[SemanticMemory] Bulk store failed", { error });
    return Err(
      makeError("SEMANTIC_MEMORY_BULK_STORE_FAILED", "Failed to bulk store memories", {
        count: requests.length,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

// ─── Export Singleton ─────────────────────────────────────────────────────────

export const semanticMemory = {
  store: storeMemory,
  search: searchMemory,
  update: updateMemory,
  delete: deleteMemory,
  getByEntity: getMemoriesByEntity,
  bulkStore: bulkStoreMemories,
};
