/**
 * SharedMemory - Shared memory layer for Qayyim Swarm
 * Uses PostgreSQL + pgvector for semantic memory, cross-agent learning
 */

import { getNextAvailableKey, setKeyCooldown, incrementKeyUsage } from "@/lib/api-keys-service";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";

export interface MemoryItem {
  id: string;
  company_id: string;
  agent_key: string;
  memory_type: 'fact' | 'preference' | 'conversation' | 'task_result' | 'pattern' | 'rule';
  content: string;
  embedding?: number[]; // 768 dimensions for Gemini gemini-embedding-001
  tags: string[];
  related_entities: Record<string, any>;
  importance_score: number; // 0-1
  access_count: number;
  last_accessed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface SwarmLearning {
  id: string;
  company_id: string;
  source_agent: string;
  target_agents: string[];
  lesson_type: 'pattern' | 'anti-pattern' | 'heuristic' | 'template' | 'best_practice';
  domain: string;
  pattern: Record<string, any>;
  evidence: Record<string, any>;
  confidence: number;
  success_count: number;
  failure_count: number;
  last_validated_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SearchResult {
  item: MemoryItem;
  similarity: number;
}

export interface LearningSearchResult {
  learning: SwarmLearning;
  relevance: number;
}

export class SharedMemory {
  private supabase: any;
  private companyId: string | null = null;
  private embeddingCache: Map<string, number[]> = new Map();
  private readonly EMBEDDING_MODEL = "gemini-embedding-001"; // 768 dims via outputDimensionality
  private readonly EMBEDDING_DIMS = 768;

  constructor() {
    this.supabase = getSupabaseAdminClient();
  }

  /**
   * Initialize with company context
   */
  async initialize(companyId?: string) {
    this.companyId = await resolveAdminCompanyId(companyId);
    if (!this.companyId) {
      throw new Error('Company ID not resolved');
    }
  }

  /**
   * Generate a real embedding via Gemini gemini-embedding-001 (truncated to 768 dims
   * via outputDimensionality — the same MRL prefix the model trains with).
   * Keys come from the same DB pool the chat orchestrator uses (provider "google").
   * THROWS on failure — no fake-vector fallbacks are allowed.
   */
  async generateEmbedding(
    text: string,
    taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"
  ): Promise<number[]> {
    const cacheKey = `${taskType}:${this.hashText(text)}`;
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    const MAX_ATTEMPTS = 3;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const keyData = await getNextAvailableKey("google");
      if (!keyData) {
        throw new Error('SharedMemory: no Google API keys available for embeddings');
      }

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.EMBEDDING_MODEL}:embedContent?key=${keyData.key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: { parts: [{ text }], role: "user" },
              taskType,
              outputDimensionality: this.EMBEDDING_DIMS,
            }),
          }
        );

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(`Gemini embedding HTTP ${response.status}: ${body.slice(0, 200)}`);
        }

        const json = await response.json();
        const values: number[] | undefined = json?.embedding?.values;
        if (!values || values.length === 0) {
          throw new Error('Gemini returned an empty embedding');
        }
        if (values.length !== this.EMBEDDING_DIMS) {
          throw new Error(`Gemini returned ${values.length} dims, expected ${this.EMBEDDING_DIMS}`);
        }
        await incrementKeyUsage("google", keyData.key);
        this.embeddingCache.set(cacheKey, values);
        return values;
      } catch (e) {
        lastError = e;
        await setKeyCooldown("google", keyData.key, 30_000);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  // ============================================
  // Memory Operations
  // ============================================

  /**
   * Store a memory item
   */
  async store(item: Omit<MemoryItem, 'id' | 'created_at' | 'access_count' | 'last_accessed_at'>): Promise<string> {
    if (!this.companyId) await this.initialize();

    const embedding = await this.generateEmbedding(item.content);

    const { data, error } = await this.supabase
      .from('qayyim_semantic_memory')
      .insert({
        company_id: this.companyId,
        agent_key: item.agent_key,
        memory_type: item.memory_type,
        content: item.content,
        embedding,
        tags: item.tags,
        related_entities: item.related_entities,
        importance_score: item.importance_score,
        expires_at: item.expires_at,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Search memories by semantic similarity
   */
  async searchSimilar(
    query: string,
    options: {
      agentKey?: string;
      memoryTypes?: MemoryItem['memory_type'][];
      limit?: number;
      minSimilarity?: number; // 0-1
      tags?: string[];
    } = {}
  ): Promise<SearchResult[]> {
    if (!this.companyId) await this.initialize();

    const queryEmbedding = await this.generateEmbedding(query, "RETRIEVAL_QUERY");
    const limit = options.limit || 10;
    const minSimilarity = options.minSimilarity || 0.7;

    // Build query
    let queryBuilder = this.supabase
      .from('qayyim_semantic_memory')
      .select('*, embedding')
      .eq('company_id', this.companyId);

    if (options.agentKey) {
      queryBuilder = queryBuilder.eq('agent_key', options.agentKey);
    }

    if (options.memoryTypes && options.memoryTypes.length > 0) {
      queryBuilder = queryBuilder.in('memory_type', options.memoryTypes);
    }

    if (options.tags && options.tags.length > 0) {
      queryBuilder = queryBuilder.overlaps('tags', options.tags);
    }

    // Filter out expired
    queryBuilder = queryBuilder.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    const { data, error } = await queryBuilder.limit(limit * 3); // Get more for filtering

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Calculate cosine similarity in JS (pgvector does it in DB but we need to filter)
    const results: SearchResult[] = data.map((item: any) => {
      if (!item.embedding) return { item: item as MemoryItem, similarity: 0 };
      const similarity = this.cosineSimilarity(queryEmbedding, item.embedding);
      return { item: item as MemoryItem, similarity };
    })
      .filter((r: SearchResult) => r.similarity >= (options.minSimilarity || 0.7))
      .sort((a: SearchResult, b: SearchResult) => b.similarity - a.similarity)
      .slice(0, limit);

    // Update access counts
    for (const result of results) {
      await this.incrementAccess(result.item.id);
    }

    return results;
  }

  /**
   * Get memory by ID
   */
  async getById(id: string): Promise<MemoryItem | null> {
    if (!this.companyId) await this.initialize();

    const { data, error } = await this.supabase
      .from('qayyim_semantic_memory')
      .select('*')
      .eq('id', id)
      .eq('company_id', this.companyId)
      .single();

    if (error || !data) return null;
    return data as MemoryItem;
  }

  /**
   * Increment access count
   */
  async incrementAccess(id: string): Promise<void> {
    await this.supabase
      .from('qayyim_semantic_memory')
      .update({
        access_count: this.supabase.raw('access_count + 1'),
        last_accessed_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  /**
   * Delete memory
   */
  async delete(id: string): Promise<void> {
    await this.supabase
      .from('qayyim_semantic_memory')
      .delete()
      .eq('id', id)
      .eq('company_id', this.companyId);
  }

  // ============================================
  // Swarm Learning Operations
  // ============================================

  /**
   * Store a swarm learning
   */
  async storeLearning(learning: Omit<SwarmLearning, 'id' | 'created_at' | 'success_count' | 'failure_count' | 'last_validated_at'>): Promise<string> {
    if (!this.companyId) await this.initialize();

    const { data, error } = await this.supabase
      .from('qayyim_swarm_learnings')
      .insert({
        company_id: this.companyId,
        source_agent: learning.source_agent,
        target_agents: learning.target_agents,
        lesson_type: learning.lesson_type,
        domain: learning.domain,
        pattern: learning.pattern,
        evidence: learning.evidence,
        confidence: learning.confidence,
        is_active: learning.is_active,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Search relevant learnings for an agent/domain
   */
  async searchLearnings(
    agentKey: string,
    domain: string,
    limit: number = 10
  ): Promise<LearningSearchResult[]> {
    if (!this.companyId) await this.initialize();

    const { data, error } = await this.supabase
      .from('qayyim_swarm_learnings')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('domain', domain)
      .eq('is_active', true)
      .or(`target_agents.cs.{${agentKey}},target_agents.cs.{}`)
      .order('confidence', { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (!data) return [];

    return data.map((learning: any) => ({
      learning: learning as SwarmLearning,
      relevance: learning.confidence,
    }));
  }

  /**
   * Record learning success/failure
   */
  async recordLearningOutcome(learningId: string, success: boolean): Promise<void> {
    const { data: current } = await this.supabase
      .from('qayyim_swarm_learnings')
      .select('success_count, failure_count')
      .eq('id', learningId)
      .single();

    if (!current) return;

    await this.supabase
      .from('qayyim_swarm_learnings')
      .update({
        success_count: success ? current.success_count + 1 : current.success_count,
        failure_count: success ? current.failure_count : current.failure_count + 1,
        last_validated_at: new Date().toISOString(),
      })
      .eq('id', learningId);
  }

  /**
   * Get learnings by source agent
   */
  async getLearningsBySource(sourceAgent: string, limit: number = 20): Promise<SwarmLearning[]> {
    if (!this.companyId) await this.initialize();

    const { data, error } = await this.supabase
      .from('qayyim_swarm_learnings')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('source_agent', sourceAgent)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as SwarmLearning[];
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Get memory statistics
   */
  async getStats(agentKey?: string): Promise<{
    totalMemories: number;
    byType: Record<string, number>;
    byAgent: Record<string, number>;
    totalLearnings: number;
    activeLearnings: number;
  }> {
    if (!this.companyId) await this.initialize();

    let query = this.supabase
      .from('qayyim_semantic_memory')
      .select('memory_type, agent_key', { count: 'exact', head: false })
      .eq('company_id', this.companyId);

    if (agentKey) {
      query = query.eq('agent_key', agentKey);
    }

    const { data: memories, count } = await query;

    // Get learnings stats
    const { data: learnings, count: learningsCount } = await this.supabase
      .from('qayyim_swarm_learnings')
      .select('is_active', { count: 'exact', head: false })
      .eq('company_id', this.companyId);

    const byType: Record<string, number> = {};
    const byAgent: Record<string, number> = {};

    memories?.forEach((m: any) => {
      byType[m.memory_type] = (byType[m.memory_type] || 0) + 1;
      byAgent[m.agent_key] = (byAgent[m.agent_key] || 0) + 1;
    });

    return {
      totalMemories: count || 0,
      byType,
      byAgent,
      totalLearnings: learningsCount || 0,
      activeLearnings: learnings?.filter((l: any) => l.is_active).length || 0,
    };
  }

  /**
   * Clear expired memories
   */
  async cleanupExpired(): Promise<number> {
    if (!this.companyId) await this.initialize();

    const { data, error } = await this.supabase
      .from('qayyim_semantic_memory')
      .delete()
      .eq('company_id', this.companyId)
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) throw error;
    return data?.length || 0;
  }
}

export const sharedMemory = new SharedMemory();
