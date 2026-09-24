/**
 * lib/vanguard/memory/supabase_persistence.ts
 * ============================================
 * Supabase implementation of ConsciousnessPersistence.
 * All state is stored in the vanguard_* tables created by 076_vanguard_consciousness.sql.
 *
 * Uses the service-role client so it bypasses RLS — only called server-side.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  type Goal,
  type Belief,
  type Memory,
  type Result,
  type VanguardError,
  GoalStatus,
  makeError,
  Ok,
  Err,
} from "@/lib/vanguard/types";
import {
  type ConsciousnessPersistence,
  type SerializableConsciousnessState,
} from "@/lib/vanguard/consciousness/consciousness_core";
import { logger } from "@/lib/vanguard/observability/logger";

// ════════════════════════════════════════════════════════════
// CLIENT FACTORY (service-role, server-only)
// ════════════════════════════════════════════════════════════

let _client: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "[supabase_persistence] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set"
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// Alias for compatibility
export const createServiceRoleClient = getServiceClient;

// ════════════════════════════════════════════════════════════
// EMBEDDING HELPER
// Helper to generate a 768-dim zero vector for memories that
// don't yet have a real embedding (real embeddings come later
// from the embedding pipeline). We never store zeros in prod —
// the embedding pipeline fills them in.
// ════════════════════════════════════════════════════════════

function zeroVector(dim = 768): number[] {
  return Array(dim).fill(0);
}

// ════════════════════════════════════════════════════════════
// SUPABASE CONSCIOUSNESS PERSISTENCE
// ════════════════════════════════════════════════════════════

export class SupabaseConsciousnessPersistence implements ConsciousnessPersistence {
  private readonly identityKey: string;

  constructor(identityKey = "vanguard-v1") {
    this.identityKey = identityKey;
  }

  // ── State ──────────────────────────────────────────────────────────────

  async saveState(
    state: SerializableConsciousnessState
  ): Promise<Result<void, VanguardError>> {
    try {
      const db = getServiceClient();

      const { error } = await db.rpc("vanguard_upsert_consciousness", {
        p_identity_key:    this.identityKey,
        p_state_name:      state.state,
        p_goals:           state.goals,
        p_root_goal_ids:   state.rootGoalIds,
        p_beliefs:         state.beliefs,
        p_context:         state.currentContext,
        p_attention_focus: state.attentionFocus ?? null,
        p_metrics:         state.metrics,
        p_decision_history: state.decisionHistory,
        p_cycle_count:     state.metrics.cycleCount,
      });

      if (error) {
        return Err(
          makeError("PERSISTENCE_SAVE_STATE", error.message, { identityKey: this.identityKey })
        );
      }

      logger.debug("[SupabasePersistence] State saved", {
        identityKey: this.identityKey,
        state: state.state,
      });
      return Ok(undefined);
    } catch (err) {
      return Err(
        makeError("PERSISTENCE_SAVE_STATE_EXCEPTION", String(err), {
          identityKey: this.identityKey,
        })
      );
    }
  }

  async loadState(): Promise<Result<SerializableConsciousnessState | null, VanguardError>> {
    try {
      const db = getServiceClient();
      const { data, error } = await db
        .from("vanguard_consciousness_state")
        .select("*")
        .eq("identity_key", this.identityKey)
        .maybeSingle();

      if (error) {
        return Err(makeError("PERSISTENCE_LOAD_STATE", error.message, { identityKey: this.identityKey }));
      }

      if (!data) return Ok(null);

      const loaded: SerializableConsciousnessState = {
        identity:       data.context?.identity ?? ({} as SerializableConsciousnessState["identity"]),
        state:          data.state_name as SerializableConsciousnessState["state"],
        goals:          (data.goals as Record<string, Goal>) ?? {},
        rootGoalIds:    (data.root_goal_ids as string[]) ?? [],
        beliefs:        (data.beliefs as Record<string, Belief>) ?? {},
        currentContext: (data.context as Record<string, unknown>) ?? {},
        attentionFocus: (data.attention_focus as string | null) ?? null,
        metrics:        (data.metrics as SerializableConsciousnessState["metrics"]) ?? ({} as SerializableConsciousnessState["metrics"]),
        decisionHistory: (data.decision_history as SerializableConsciousnessState["decisionHistory"]) ?? [],
        timestamp:      data.snapshotted_at ?? new Date().toISOString(),
      };

      logger.debug("[SupabasePersistence] State loaded", {
        identityKey: this.identityKey,
        state: loaded.state,
        goalCount: Object.keys(loaded.goals).length,
      });

      return Ok(loaded);
    } catch (err) {
      return Err(
        makeError("PERSISTENCE_LOAD_STATE_EXCEPTION", String(err), { identityKey: this.identityKey })
      );
    }
  }

  // ── Goals ─────────────────────────────────────────────────────────────

  async getActiveGoals(): Promise<Result<Goal[], VanguardError>> {
    try {
      const db = getServiceClient();
      // Goals are stored inside the consciousness_state JSONB column.
      // We load them via loadState to avoid a separate goals table in this iteration.
      const stateResult = await this.loadState();
      if (!stateResult.ok) return Err(stateResult.error);
      if (!stateResult.value) return Ok([]);

      const goals = Object.values(stateResult.value.goals).filter(
        (g) => g.status === GoalStatus.ACTIVE
      );
      return Ok(goals);
    } catch (err) {
      return Err(makeError("PERSISTENCE_GET_GOALS", String(err)));
    }
  }

  async storeGoal(goal: Goal): Promise<Result<void, VanguardError>> {
    // Goals are persisted as part of the full state snapshot via saveState().
    // This no-ops here — the caller (ConsciousnessCore) saves state periodically.
    logger.debug("[SupabasePersistence] storeGoal (deferred to saveState)", { goalId: goal.id });
    return Ok(undefined);
  }

  // ── Beliefs ───────────────────────────────────────────────────────────

  async storeBelief(belief: Belief): Promise<Result<void, VanguardError>> {
    // Same pattern as goals — persisted via saveState().
    logger.debug("[SupabasePersistence] storeBelief (deferred to saveState)", { beliefId: belief.id });
    return Ok(undefined);
  }

  async getRelevantBeliefs(
    context: Record<string, unknown>
  ): Promise<Result<Belief[], VanguardError>> {
    const stateResult = await this.loadState();
    if (!stateResult.ok) return Err(stateResult.error);
    if (!stateResult.value) return Ok([]);
    return Ok(Object.values(stateResult.value.beliefs));
  }

  // ── Memories ──────────────────────────────────────────────────────────

  async storeMemory(memory: Memory): Promise<Result<string, VanguardError>> {
    try {
      const db = getServiceClient();

      const embedding = memory.embedding ?? zeroVector(768);
      // Trim to 768 dims if a different size came in
      const vec768 = embedding.length === 768
        ? embedding
        : embedding.slice(0, 768).concat(Array(Math.max(0, 768 - embedding.length)).fill(0));

      const row = {
        entity_type:   memory.type,
        entity_id:     memory.id,
        chunk_index:   0,
        content:       memory.content,
        embedding:     `[${vec768.join(",")}]`,  // pgvector text literal
        tags:          memory.tags,
        language:      "ar",
        importance:    memory.importance,
        access_count:  memory.accessCount,
        last_accessed: memory.accessedAt,
      };

      const { data, error } = await db
        .from("vanguard_embeddings")
        .upsert(row, { onConflict: "entity_type,entity_id,chunk_index" })
        .select("id")
        .single();

      if (error) {
        return Err(makeError("PERSISTENCE_STORE_MEMORY", error.message, { memoryId: memory.id }));
      }

      logger.debug("[SupabasePersistence] Memory stored", {
        memoryId: memory.id,
        rowId: data.id,
      });
      return Ok(data.id as string);
    } catch (err) {
      return Err(makeError("PERSISTENCE_STORE_MEMORY_EXCEPTION", String(err)));
    }
  }

  async retrieveRelevantMemories(
    query: string,
    limit = 10
  ): Promise<Result<Memory[], VanguardError>> {
    try {
      const db = getServiceClient();

      // Without a real embedding at retrieval time we fall back to full-text search.
      // The embedding pipeline will backfill real vectors; for now, text search suffices.
      const { data, error } = await db
        .from("vanguard_embeddings")
        .select("*")
        .textSearch("content", query, { type: "websearch", config: "arabic" })
        .order("importance", { ascending: false })
        .limit(limit);

      if (error) {
        return Err(makeError("PERSISTENCE_RETRIEVE_MEMORIES", error.message));
      }

      const memories: Memory[] = (data ?? []).map((row) => ({
        id:             row.entity_id as string,
        type:           row.entity_type as Memory["type"],
        content:        row.content as string,
        importance:     Number(row.importance),
        emotionalValence: 0,
        tags:           (row.tags as string[]) ?? [],
        context:        {},
        createdAt:      row.created_at as string,
        accessedAt:     (row.last_accessed as string) ?? row.created_at,
        accessCount:    Number(row.access_count),
        source:         "experience" as Memory["source"],
        confidence:     1.0,
        associationIds: [],
      }));

      return Ok(memories);
    } catch (err) {
      return Err(makeError("PERSISTENCE_RETRIEVE_MEMORIES_EXCEPTION", String(err)));
    }
  }
}

// ════════════════════════════════════════════════════════════
// FACTORY
// ════════════════════════════════════════════════════════════

let _persistence: SupabaseConsciousnessPersistence | null = null;

export function getConsciousnessPersistence(
  identityKey = "vanguard-v1"
): SupabaseConsciousnessPersistence {
  if (!_persistence) {
    _persistence = new SupabaseConsciousnessPersistence(identityKey);
  }
  return _persistence;
}
