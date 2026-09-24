/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – Vector Store
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 2: Task 3 – pgvector CRUD operations on vanguard_embeddings table
 * 
 * Manages vector embeddings in PostgreSQL with pgvector extension.
 * Uses HNSW index (m=16, ef_construction=64) for fast approximate search.
 * 
 * Operations:
 * - insert: Add new embedding
 * - update: Update existing embedding
 * - delete: Remove embedding
 * - search: Hybrid search (vector similarity + keyword + filters)
 */

import { createServiceRoleClient } from "@/lib/vanguard/memory/supabase_persistence";
import { logger } from "@/lib/vanguard/observability/logger";
import type { Result, VanguardError } from "@/lib/vanguard/types";
import { Ok, Err, makeError } from "@/lib/vanguard/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VectorRecord {
  id: string;
  entity_type: string; // 'material','product','learning','memory','lead','belief','document'
  entity_id: string;
  content: string;
  embedding: number[]; // 768-dim vector
  metadata: Record<string, unknown>;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface VectorSearchOptions {
  query: string;
  queryEmbedding?: number[]; // If already generated, pass it
  entityTypes?: string[]; // Filter by entity_type
  limit?: number; // Default: 10
  threshold?: number; // Minimum similarity score (0-1)
  metadata?: Record<string, unknown>; // Additional filters
}

export interface VectorSearchResult {
  id: string;
  entity_type: string;
  entity_id: string;
  content: string;
  similarity: number; // 0-1 (cosine similarity)
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Insert: Add New Embedding ───────────────────────────────────────────────

export async function insertEmbedding(record: {
  entity_type: string;
  entity_id: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  model?: string;
}): Promise<Result<VectorRecord, VanguardError>> {
  const supabase = createServiceRoleClient();

  try {
    const { data, error } = await supabase
      .from("vanguard_embeddings")
      .insert({
        entity_type: record.entity_type,
        entity_id: record.entity_id,
        content: record.content,
        embedding_768: record.embedding,
        metadata: record.metadata || {},
        model: record.model || "sentence-transformers/all-MiniLM-L6-v2",
      })
      .select()
      .single();

    if (error) {
      logger.error("[VectorStore] Insert failed", { error: error.message });
      return Err(
        makeError("VECTOR_INSERT_FAILED", `Failed to insert embedding: ${error.message}`, {
          entity_type: record.entity_type,
          entity_id: record.entity_id,
        })
      );
    }

    logger.info("[VectorStore] Embedding inserted", {
      id: data.id,
      entity_type: record.entity_type,
      entity_id: record.entity_id,
    });

    return Ok({
      id: data.id,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      content: data.content,
      embedding: data.embedding_768 as number[],
      metadata: data.metadata as Record<string, unknown>,
      model: data.model,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  } catch (error) {
    logger.error("[VectorStore] Unexpected insert error", { error });
    return Err(
      makeError("VECTOR_STORE_ERROR", "Unexpected error during insert", {
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

// ─── Update: Modify Existing Embedding ───────────────────────────────────────

export async function updateEmbedding(
  id: string,
  updates: {
    content?: string;
    embedding?: number[];
    metadata?: Record<string, unknown>;
  }
): Promise<Result<VectorRecord, VanguardError>> {
  const supabase = createServiceRoleClient();

  try {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.content) payload.content = updates.content;
    if (updates.embedding) payload.embedding_768 = updates.embedding;
    if (updates.metadata) payload.metadata = updates.metadata;

    const { data, error } = await supabase
      .from("vanguard_embeddings")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[VectorStore] Update failed", { id, error: error.message });
      return Err(
        makeError("VECTOR_UPDATE_FAILED", `Failed to update embedding: ${error.message}`, { id })
      );
    }

    if (!data) {
      return Err(makeError("VECTOR_NOT_FOUND", `Embedding not found: ${id}`, { id }));
    }

    logger.info("[VectorStore] Embedding updated", { id });

    return Ok({
      id: data.id,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      content: data.content,
      embedding: data.embedding_768 as number[],
      metadata: data.metadata as Record<string, unknown>,
      model: data.model,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  } catch (error) {
    logger.error("[VectorStore] Unexpected update error", { id, error });
    return Err(
      makeError("VECTOR_STORE_ERROR", "Unexpected error during update", {
        id,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

// ─── Delete: Remove Embedding ────────────────────────────────────────────────

export async function deleteEmbedding(id: string): Promise<Result<void, VanguardError>> {
  const supabase = createServiceRoleClient();

  try {
    const { error } = await supabase.from("vanguard_embeddings").delete().eq("id", id);

    if (error) {
      logger.error("[VectorStore] Delete failed", { id, error: error.message });
      return Err(
        makeError("VECTOR_DELETE_FAILED", `Failed to delete embedding: ${error.message}`, { id })
      );
    }

    logger.info("[VectorStore] Embedding deleted", { id });
    return Ok(undefined);
  } catch (error) {
    logger.error("[VectorStore] Unexpected delete error", { id, error });
    return Err(
      makeError("VECTOR_STORE_ERROR", "Unexpected error during delete", {
        id,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

// ─── Search: Hybrid Vector + Keyword Search ──────────────────────────────────

export async function searchEmbeddings(
  options: VectorSearchOptions
): Promise<Result<VectorSearchResult[], VanguardError>> {
  const supabase = createServiceRoleClient();

  try {
    const limit = options.limit || 10;
    const threshold = options.threshold || 0.5;

    // If queryEmbedding not provided, we can't do vector search
    // Fall back to keyword search only (not implemented here, needs full-text search)
    if (!options.queryEmbedding) {
      logger.warn("[VectorStore] No query embedding provided, cannot perform vector search");
      return Ok([]);
    }

    // Vector similarity search using pgvector <=> operator
    // Note: Supabase RPC call needed for vector operations
    const { data, error } = await supabase.rpc("vanguard_hybrid_search", {
      query_embedding: options.queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      filter_entity_types: options.entityTypes || null,
    });

    if (error) {
      logger.error("[VectorStore] Search failed", { error: error.message });
      return Err(
        makeError("VECTOR_SEARCH_FAILED", `Failed to search embeddings: ${error.message}`, {
          query: options.query,
        })
      );
    }

    if (!data || data.length === 0) {
      logger.debug("[VectorStore] No results found", { query: options.query });
      return Ok([]);
    }

    const results: VectorSearchResult[] = data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      entity_type: row.entity_type as string,
      entity_id: row.entity_id as string,
      content: row.content as string,
      similarity: row.similarity as number,
      metadata: (row.metadata as Record<string, unknown>) || {},
      created_at: row.created_at as string,
    }));

    logger.info("[VectorStore] Search complete", {
      query: options.query,
      resultsCount: results.length,
      topSimilarity: results[0]?.similarity,
    });

    return Ok(results);
  } catch (error) {
    logger.error("[VectorStore] Unexpected search error", { error });
    return Err(
      makeError("VECTOR_STORE_ERROR", "Unexpected error during search", {
        query: options.query,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

// ─── Get By Entity ───────────────────────────────────────────────────────────

export async function getEmbeddingsByEntity(
  entity_type: string,
  entity_id: string
): Promise<Result<VectorRecord[], VanguardError>> {
  const supabase = createServiceRoleClient();

  try {
    const { data, error } = await supabase
      .from("vanguard_embeddings")
      .select("*")
      .eq("entity_type", entity_type)
      .eq("entity_id", entity_id);

    if (error) {
      logger.error("[VectorStore] Get by entity failed", { entity_type, entity_id, error: error.message });
      return Err(
        makeError("VECTOR_FETCH_FAILED", `Failed to fetch embeddings: ${error.message}`, {
          entity_type,
          entity_id,
        })
      );
    }

    const records: VectorRecord[] = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      entity_type: row.entity_type as string,
      entity_id: row.entity_id as string,
      content: row.content as string,
      embedding: row.embedding_768 as number[],
      metadata: (row.metadata as Record<string, unknown>) || {},
      model: row.model as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }));

    return Ok(records);
  } catch (error) {
    logger.error("[VectorStore] Unexpected get by entity error", { entity_type, entity_id, error });
    return Err(
      makeError("VECTOR_STORE_ERROR", "Unexpected error during fetch", {
        entity_type,
        entity_id,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

// ─── Bulk Insert ─────────────────────────────────────────────────────────────

export async function bulkInsertEmbeddings(
  records: Array<{
    entity_type: string;
    entity_id: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
    model?: string;
  }>
): Promise<Result<number, VanguardError>> {
  const supabase = createServiceRoleClient();

  try {
    const payload = records.map((r) => ({
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      content: r.content,
      embedding_768: r.embedding,
      metadata: r.metadata || {},
      model: r.model || "sentence-transformers/all-MiniLM-L6-v2",
    }));

    const { data, error } = await supabase.from("vanguard_embeddings").insert(payload).select("id");

    if (error) {
      logger.error("[VectorStore] Bulk insert failed", { count: records.length, error: error.message });
      return Err(
        makeError("VECTOR_BULK_INSERT_FAILED", `Failed to bulk insert: ${error.message}`, {
          count: records.length,
        })
      );
    }

    const insertedCount = data?.length || 0;
    logger.info("[VectorStore] Bulk insert complete", { inserted: insertedCount });

    return Ok(insertedCount);
  } catch (error) {
    logger.error("[VectorStore] Unexpected bulk insert error", { count: records.length, error });
    return Err(
      makeError("VECTOR_STORE_ERROR", "Unexpected error during bulk insert", {
        count: records.length,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
