/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – Memory Consolidator
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 2: Task 5 – Compress and maintain memory quality
 * 
 * Periodic maintenance operations:
 * 1. Merge similar memories (deduplicate)
 * 2. Archive old, low-relevance memories
 * 3. Maintain diversity (prevent echo chamber)
 * 4. Prune redundant embeddings
 * 
 * Run this periodically (e.g., daily via cron or background task).
 */

import { logger } from "@/lib/vanguard/observability/logger";
import type { Result, VanguardError } from "@/lib/vanguard/types";
import { Ok, Err, makeError } from "@/lib/vanguard/types";
import { createServiceRoleClient } from "@/lib/vanguard/memory/supabase_persistence";
import { cosineSimilarity } from "./embedding_service";
import { deleteEmbedding, type VectorRecord } from "./vector_store";

// ─── Configuration ───────────────────────────────────────────────────────────

const SIMILARITY_THRESHOLD_MERGE = 0.95; // If >95% similar, consider merging
const MAX_MEMORY_AGE_DAYS = 90; // Archive memories older than 90 days (if low importance)
const LOW_IMPORTANCE_THRESHOLD = 0.3; // Importance score below this = archivable
const MAX_MEMORIES_PER_ENTITY = 100; // Keep top 100 per entity, archive rest
const DIVERSITY_SAMPLE_SIZE = 50; // Check diversity in recent 50 memories

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConsolidationReport {
  totalScanned: number;
  merged: number;
  archived: number;
  pruned: number;
  diversityScore: number; // 0-1 (1 = highly diverse)
  executionTimeMs: number;
}

interface MemoryWithImportance extends VectorRecord {
  importance: number; // Derived score (0-1)
}

// ─── Main: Consolidate Memories ──────────────────────────────────────────────

export async function consolidateMemories(
  options?: {
    entityType?: string; // Consolidate specific entity type only
    dryRun?: boolean; // Preview changes without applying
  }
): Promise<Result<ConsolidationReport, VanguardError>> {
  const startTime = Date.now();
  const dryRun = options?.dryRun || false;

  logger.info("[MemoryConsolidator] Starting consolidation", {
    entityType: options?.entityType || "all",
    dryRun,
  });

  try {
    const supabase = createServiceRoleClient();

    // Step 1: Fetch all embeddings (or filtered by entity_type)
    let query = supabase.from("vanguard_embeddings").select("*");

    if (options?.entityType) {
      query = query.eq("entity_type", options.entityType);
    }

    const { data, error } = await query;

    if (error) {
      return Err(
        makeError("CONSOLIDATION_FETCH_FAILED", `Failed to fetch memories: ${error.message}`, {
          entityType: options?.entityType,
        })
      );
    }

    if (!data || data.length === 0) {
      logger.info("[MemoryConsolidator] No memories to consolidate");
      return Ok({
        totalScanned: 0,
        merged: 0,
        archived: 0,
        pruned: 0,
        diversityScore: 1.0,
        executionTimeMs: Date.now() - startTime,
      });
    }

    const memories: MemoryWithImportance[] = data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      entity_type: row.entity_type as string,
      entity_id: row.entity_id as string,
      content: row.content as string,
      embedding: row.embedding_768 as number[],
      metadata: (row.metadata as Record<string, unknown>) || {},
      model: row.model as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      importance: calculateImportance(row),
    }));

    logger.debug("[MemoryConsolidator] Memories loaded", { count: memories.length });

    // Step 2: Merge similar memories
    const mergedIds = await mergeSimilarMemories(memories, dryRun);

    // Step 3: Archive old, low-importance memories
    const archivedIds = await archiveOldMemories(memories, dryRun);

    // Step 4: Prune excess memories per entity
    const prunedIds = await pruneExcessMemories(memories, dryRun);

    // Step 5: Calculate diversity score
    const diversityScore = calculateDiversityScore(memories);

    const duration = Date.now() - startTime;

    const report: ConsolidationReport = {
      totalScanned: memories.length,
      merged: mergedIds.length,
      archived: archivedIds.length,
      pruned: prunedIds.length,
      diversityScore,
      executionTimeMs: duration,
    };

    logger.info("[MemoryConsolidator] Consolidation complete", {
      totalScanned: report.totalScanned,
      merged: report.merged,
      archived: report.archived,
      pruned: report.pruned,
      diversityScore: report.diversityScore,
      executionTimeMs: report.executionTimeMs,
    });

    return Ok(report);
  } catch (error) {
    logger.error("[MemoryConsolidator] Consolidation failed", { error });
    return Err(
      makeError("CONSOLIDATION_FAILED", "Memory consolidation failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

// ─── Helper: Calculate Importance Score ──────────────────────────────────────

function calculateImportance(memory: Record<string, unknown>): number {
  let score = 0.5; // Base score

  // Factor 1: Entity type priority
  const entityType = memory.entity_type as string;
  if (entityType === "learning") score += 0.3;
  else if (entityType === "belief") score += 0.2;
  else if (entityType === "memory") score += 0.1;

  // Factor 2: Recency (exponential decay)
  const createdAt = new Date(memory.created_at as string);
  const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.pow(2, -ageInDays / 30); // Half-life 30 days
  score += recencyScore * 0.2;

  // Factor 3: Metadata flags (if marked as important)
  const metadata = memory.metadata as Record<string, unknown>;
  if (metadata?.important === true) score += 0.3;
  if (metadata?.verified === true) score += 0.2;

  return Math.min(1.0, score); // Clamp to [0, 1]
}

// ─── Step 2: Merge Similar Memories ──────────────────────────────────────────

async function mergeSimilarMemories(
  memories: MemoryWithImportance[],
  dryRun: boolean
): Promise<string[]> {
  const toMerge: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < memories.length; i++) {
    if (seen.has(memories[i].id)) continue;

    for (let j = i + 1; j < memories.length; j++) {
      if (seen.has(memories[j].id)) continue;

      // Only compare same entity type
      if (memories[i].entity_type !== memories[j].entity_type) continue;

      // Calculate similarity
      const similarity = cosineSimilarity(memories[i].embedding, memories[j].embedding);

      if (similarity >= SIMILARITY_THRESHOLD_MERGE) {
        // Merge: keep higher importance, delete lower
        const keepIdx = memories[i].importance >= memories[j].importance ? i : j;
        const deleteIdx = keepIdx === i ? j : i;

        toMerge.push(memories[deleteIdx].id);
        seen.add(memories[deleteIdx].id);

        logger.debug("[MemoryConsolidator] Found duplicate", {
          id1: memories[i].id,
          id2: memories[j].id,
          similarity: similarity.toFixed(3),
          keeping: memories[keepIdx].id,
        });
      }
    }
  }

  // Execute deletions
  if (!dryRun && toMerge.length > 0) {
    for (const id of toMerge) {
      await deleteEmbedding(id);
    }
    logger.info("[MemoryConsolidator] Merged duplicates", { count: toMerge.length });
  } else if (dryRun) {
    logger.info("[MemoryConsolidator] [DRY RUN] Would merge", { count: toMerge.length });
  }

  return toMerge;
}

// ─── Step 3: Archive Old, Low-Importance Memories ─────────────────────────────

async function archiveOldMemories(
  memories: MemoryWithImportance[],
  dryRun: boolean
): Promise<string[]> {
  const toArchive: string[] = [];
  const now = Date.now();

  for (const memory of memories) {
    const ageInDays = (now - new Date(memory.created_at).getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays > MAX_MEMORY_AGE_DAYS && memory.importance < LOW_IMPORTANCE_THRESHOLD) {
      toArchive.push(memory.id);
    }
  }

  // Execute deletions (or move to archive table in future)
  if (!dryRun && toArchive.length > 0) {
    for (const id of toArchive) {
      await deleteEmbedding(id);
    }
    logger.info("[MemoryConsolidator] Archived old memories", { count: toArchive.length });
  } else if (dryRun) {
    logger.info("[MemoryConsolidator] [DRY RUN] Would archive", { count: toArchive.length });
  }

  return toArchive;
}

// ─── Step 4: Prune Excess Memories per Entity ─────────────────────────────────

async function pruneExcessMemories(
  memories: MemoryWithImportance[],
  dryRun: boolean
): Promise<string[]> {
  const toPrune: string[] = [];

  // Group by entity_type + entity_id
  const byEntity = new Map<string, MemoryWithImportance[]>();

  for (const memory of memories) {
    const key = `${memory.entity_type}:${memory.entity_id}`;
    if (!byEntity.has(key)) {
      byEntity.set(key, []);
    }
    byEntity.get(key)!.push(memory);
  }

  // For each entity, keep top N by importance, prune rest
  for (const [key, entityMemories] of byEntity.entries()) {
    if (entityMemories.length <= MAX_MEMORIES_PER_ENTITY) continue;

    // Sort by importance descending
    entityMemories.sort((a, b) => b.importance - a.importance);

    // Mark excess for pruning
    const excess = entityMemories.slice(MAX_MEMORIES_PER_ENTITY);
    for (const memory of excess) {
      toPrune.push(memory.id);
    }

    logger.debug("[MemoryConsolidator] Pruning excess memories", {
      entity: key,
      total: entityMemories.length,
      keeping: MAX_MEMORIES_PER_ENTITY,
      pruning: excess.length,
    });
  }

  // Execute deletions
  if (!dryRun && toPrune.length > 0) {
    for (const id of toPrune) {
      await deleteEmbedding(id);
    }
    logger.info("[MemoryConsolidator] Pruned excess memories", { count: toPrune.length });
  } else if (dryRun) {
    logger.info("[MemoryConsolidator] [DRY RUN] Would prune", { count: toPrune.length });
  }

  return toPrune;
}

// ─── Step 5: Calculate Diversity Score ───────────────────────────────────────

function calculateDiversityScore(memories: MemoryWithImportance[]): number {
  if (memories.length < 2) return 1.0;

  // Sample recent memories
  const sample = memories
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, DIVERSITY_SAMPLE_SIZE);

  if (sample.length < 2) return 1.0;

  // Calculate average pairwise dissimilarity
  let totalDissimilarity = 0;
  let pairCount = 0;

  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      const similarity = cosineSimilarity(sample[i].embedding, sample[j].embedding);
      totalDissimilarity += 1 - similarity;
      pairCount++;
    }
  }

  const diversityScore = pairCount > 0 ? totalDissimilarity / pairCount : 1.0;
  return Math.min(1.0, diversityScore);
}

// ─── Helper: Get Consolidation Stats ──────────────────────────────────────────

export async function getConsolidationStats(): Promise<
  Result<
    {
      totalMemories: number;
      byEntityType: Record<string, number>;
      oldestMemory: string | null;
      newestMemory: string | null;
      averageImportance: number;
    },
    VanguardError
  >
> {
  try {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase.from("vanguard_embeddings").select("*");

    if (error) {
      return Err(makeError("STATS_FETCH_FAILED", `Failed to fetch stats: ${error.message}`));
    }

    if (!data || data.length === 0) {
      return Ok({
        totalMemories: 0,
        byEntityType: {},
        oldestMemory: null,
        newestMemory: null,
        averageImportance: 0,
      });
    }

    const byEntityType: Record<string, number> = {};
    let totalImportance = 0;

    for (const row of data) {
      byEntityType[row.entity_type] = (byEntityType[row.entity_type] || 0) + 1;
      totalImportance += calculateImportance(row);
    }

    const sortedByDate = [...data].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return Ok({
      totalMemories: data.length,
      byEntityType,
      oldestMemory: sortedByDate[0]?.created_at || null,
      newestMemory: sortedByDate[sortedByDate.length - 1]?.created_at || null,
      averageImportance: totalImportance / data.length,
    });
  } catch (error) {
    logger.error("[MemoryConsolidator] Stats fetch failed", { error });
    return Err(
      makeError("CONSOLIDATION_STATS_FAILED", "Failed to get consolidation stats", {
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
