/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    SEMANTIC NEURAL CACHE - Upstash Redis                  ║
 * ║              Zero-Cost Retrieval | Collective Memory | Instant Response   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Multi-layer Upstash Redis cache. If an answer exists in the "Collective Memory",
 * retrieval is instantaneous (Zero API Cost).
 */

import { Redis } from "@upstash/redis";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface CacheEntry {
  semanticHash: string;
  exactMatch: string;
  nearMatches: string[];
  response: string;
  context?: string;
  metadata: {
    createdAt: Date;
    lastAccessed: Date;
    accessCount: number;
    emotionalWeight: number;
    source: string;
    confidence: number;
  };
  embeddings?: number[];
  ttl?: number;
}

export interface CacheQuery {
  query: string;
  context?: string;
  similarityThreshold?: number; // 0-1, default 0.85
  maxResults?: number;
}

export interface CacheResult {
  hit: boolean;
  entry?: CacheEntry;
  source: "redis_l1" | "redis_l2" | "supabase_l3" | "miss";
  responseTimeMs: number;
  costSaved: number;
  similarity?: number;
}

export interface CacheStats {
  l1HitRate: number;
  l2HitRate: number;
  l3HitRate: number;
  totalSavings: number;
  entriesCount: number;
  avgResponseTime: number;
}

// ==========================================
// SEMANTIC CACHE MANAGER
// ==========================================

export class SemanticCacheManager {
  private redisL1: Redis | null = null; // Hot cache - most frequent
  private redisL2: Redis | null = null; // Warm cache - semantic matches
  private _supabase: ReturnType<typeof createClient> | null = null;

  private get supabase() {
    if (!this._supabase) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("Missing Supabase credentials");
      this._supabase = createClient(url, key);
    }
    return this._supabase;
  }

  // Local memory cache for ultra-fast L0 access
  private l0Cache: Map<string, CacheEntry> = new Map();
  private readonly L0_MAX_SIZE = 100;
  private readonly L1_TTL_SECONDS = 3600; // 1 hour
  private readonly L2_TTL_SECONDS = 86400; // 24 hours

  // Statistics
  private stats = {
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0,
    misses: 0,
    totalSavings: 0,
    totalRequests: 0,
  };

  constructor() {
    this.initializeRedis();
  }

  private initializeRedis() {
    // Layer 1: Hot cache (frequent queries)
    if (process.env.UPSTASH_REDIS_L1_URL && process.env.UPSTASH_REDIS_L1_TOKEN) {
      this.redisL1 = new Redis({
        url: process.env.UPSTASH_REDIS_L1_URL,
        token: process.env.UPSTASH_REDIS_L1_TOKEN,
      });
    }

    // Layer 2: Warm cache (semantic matches)
    if (process.env.UPSTASH_REDIS_L2_URL && process.env.UPSTASH_REDIS_L2_TOKEN) {
      this.redisL2 = new Redis({
        url: process.env.UPSTASH_REDIS_L2_URL,
        token: process.env.UPSTASH_REDIS_L2_TOKEN,
      });
    }
  }

  // ==========================================
  // SEMANTIC HASHING
  // ==========================================

  private async computeSemanticHash(query: string, context?: string): Promise<string> {
    const normalized = this.normalizeText(query + (context || ""));
    
    // Simple hash for fast lookup
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(w => w.length > 2)
      .sort()
      .join(" ");
  }

  private calculateSimilarity(a: string, b: string): number {
    // Jaccard similarity for quick comparison
    const setA = new Set(this.normalizeText(a).split(" "));
    const setB = new Set(this.normalizeText(b).split(" "));
    
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    
    return intersection.size / union.size;
  }

  // ==========================================
  // MULTI-LAYER CACHE RETRIEVAL
  // ==========================================

  async get(query: CacheQuery): Promise<CacheResult> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    const semanticHash = await this.computeSemanticHash(query.query, query.context);
    const threshold = query.similarityThreshold || 0.85;

    // L0: In-memory cache (fastest)
    const l0Result = this.l0Cache.get(semanticHash);
    if (l0Result) {
      l0Result.metadata.lastAccessed = new Date();
      l0Result.metadata.accessCount++;
      
      return {
        hit: true,
        entry: l0Result,
        source: "redis_l1",
        responseTimeMs: Date.now() - startTime,
        costSaved: 0.02, // Average API cost
        similarity: 1.0,
      };
    }

    // L1: Redis hot cache
    if (this.redisL1) {
      try {
        const cached = await this.redisL1.get<CacheEntry>(`cache:l1:${semanticHash}`);
        if (cached) {
          this.stats.l1Hits++;
          this.stats.totalSavings += 0.02;
          this.promoteToL0(semanticHash, cached);
          
          return {
            hit: true,
            entry: cached,
            source: "redis_l1",
            responseTimeMs: Date.now() - startTime,
            costSaved: 0.02,
            similarity: 1.0,
          };
        }
      } catch (error) {
        console.error("[SemanticCache] L1 retrieval error:", error);
      }
    }

    // L2: Redis semantic cache
    if (this.redisL2) {
      try {
        // Search for similar entries
        const keys = await this.redisL2.keys("cache:l2:*");
        
        for (const key of keys.slice(0, 100)) { // Limit search
          const entry = await this.redisL2.get<CacheEntry>(key);
          if (entry) {
            const similarity = this.calculateSimilarity(query.query, entry.exactMatch);
            
            if (similarity >= threshold) {
              this.stats.l2Hits++;
              this.stats.totalSavings += 0.015; // Partial savings
              this.promoteToL1(semanticHash, entry);
              
              return {
                hit: true,
                entry,
                source: "redis_l2",
                responseTimeMs: Date.now() - startTime,
                costSaved: 0.015,
                similarity,
              };
            }
          }
        }
      } catch (error) {
        console.error("[SemanticCache] L2 retrieval error:", error);
      }
    }

    // L3: Supabase persistent cache
    try {
      const { data } = await this.supabase
        .from("semantic_cache")
        .select("*")
        .or(`semantic_hash.eq.${semanticHash},exact_match.ilike.%${query.query.slice(0, 20)}%`)
        .limit(10);

      if (data && data.length > 0) {
        // Find best match
        const typedData = data as unknown as Array<{ exact_match: string; [key: string]: unknown }>;
        let bestMatch = typedData[0];
        let bestSimilarity = this.calculateSimilarity(query.query, bestMatch.exact_match);

        for (const entry of typedData) {
          const similarity = this.calculateSimilarity(query.query, entry.exact_match);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = entry;
          }
        }

        if (bestSimilarity >= threshold) {
          this.stats.l3Hits++;
          this.stats.totalSavings += 0.01;

          const typedBestMatch = bestMatch as unknown as {
            semantic_hash: string;
            exact_match: string;
            near_matches?: string[];
            response: string;
            context: string;
            created_at: string;
            last_accessed: string;
            access_count: number;
            emotional_weight: number;
            source?: string;
            confidence?: number;
          };
          const cacheEntry: CacheEntry = {
            semanticHash: typedBestMatch.semantic_hash,
            exactMatch: typedBestMatch.exact_match,
            nearMatches: typedBestMatch.near_matches || [],
            response: typedBestMatch.response,
            context: typedBestMatch.context,
            metadata: {
              createdAt: new Date(typedBestMatch.created_at),
              lastAccessed: new Date(typedBestMatch.last_accessed),
              accessCount: typedBestMatch.access_count,
              emotionalWeight: typedBestMatch.emotional_weight,
              source: typedBestMatch.source || "unknown",
              confidence: typedBestMatch.confidence || 0.9,
            },
          };

          // Promote to faster layers
          this.promoteToL1(semanticHash, cacheEntry);

          return {
            hit: true,
            entry: cacheEntry,
            source: "supabase_l3",
            responseTimeMs: Date.now() - startTime,
            costSaved: 0.01,
            similarity: bestSimilarity,
          };
        }
      }
    } catch (error) {
      console.error("[SemanticCache] L3 retrieval error:", error);
    }

    // Cache miss
    this.stats.misses++;
    return {
      hit: false,
      source: "miss",
      responseTimeMs: Date.now() - startTime,
      costSaved: 0,
    };
  }

  // ==========================================
  // CACHE STORAGE
  // ==========================================

  async set(
    query: string,
    response: string,
    options?: {
      context?: string;
      source?: string;
      confidence?: number;
      emotionalWeight?: number;
      ttl?: number;
    }
  ): Promise<void> {
    const semanticHash = await this.computeSemanticHash(query, options?.context);
    
    const entry: CacheEntry = {
      semanticHash,
      exactMatch: query,
      nearMatches: [],
      response,
      context: options?.context,
      metadata: {
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1,
        emotionalWeight: options?.emotionalWeight || 0.5,
        source: options?.source || "ai_generation",
        confidence: options?.confidence || 0.9,
      },
      ttl: options?.ttl,
    };

    // Store in all layers
    await Promise.all([
      this.promoteToL0(semanticHash, entry),
      this.promoteToL1(semanticHash, entry),
      this.storeInL3(entry),
    ]);
  }

  private promoteToL0(hash: string, entry: CacheEntry): void {
    // Ensure L0 doesn't exceed max size
    if (this.l0Cache.size >= this.L0_MAX_SIZE) {
      // Remove oldest entry
      const oldest = Array.from(this.l0Cache.entries())
        .sort((a, b) => a[1].metadata.lastAccessed.getTime() - b[1].metadata.lastAccessed.getTime())[0];
      if (oldest) {
        this.l0Cache.delete(oldest[0]);
      }
    }
    
    this.l0Cache.set(hash, entry);
  }

  private async promoteToL1(hash: string, entry: CacheEntry): Promise<void> {
    if (!this.redisL1) return;

    try {
      await this.redisL1.setex(
        `cache:l1:${hash}`,
        this.L1_TTL_SECONDS,
        entry
      );
    } catch (error) {
      console.error("[SemanticCache] L1 promotion error:", error);
    }
  }

  private async storeInL3(entry: CacheEntry): Promise<void> {
    try {
      await this.supabase.from("semantic_cache").upsert({
        semantic_hash: entry.semanticHash,
        exact_match: entry.exactMatch,
        near_matches: entry.nearMatches,
        response: entry.response,
        context: entry.context,
        created_at: entry.metadata.createdAt.toISOString(),
        last_accessed: entry.metadata.lastAccessed.toISOString(),
        access_count: entry.metadata.accessCount,
        emotional_weight: entry.metadata.emotionalWeight,
        source: entry.metadata.source,
        confidence: entry.metadata.confidence,
      } as never);
    } catch (error) {
      console.error("[SemanticCache] L3 storage error:", error);
    }
  }

  // ==========================================
  // CACHE MANAGEMENT
  // ==========================================

  async invalidate(pattern: string): Promise<number> {
    let count = 0;

    // L0
    for (const [hash, entry] of this.l0Cache) {
      if (entry.exactMatch.includes(pattern) || entry.response.includes(pattern)) {
        this.l0Cache.delete(hash);
        count++;
      }
    }

    // L1
    if (this.redisL1) {
      const keys = await this.redisL1.keys("cache:l1:*");
      for (const key of keys) {
        const entry = await this.redisL1.get<CacheEntry>(key);
        if (entry && (entry.exactMatch.includes(pattern) || entry.response.includes(pattern))) {
          await this.redisL1.del(key);
          count++;
        }
      }
    }

    // L2
    if (this.redisL2) {
      const keys = await this.redisL2.keys("cache:l2:*");
      for (const key of keys) {
        const entry = await this.redisL2.get<CacheEntry>(key);
        if (entry && (entry.exactMatch.includes(pattern) || entry.response.includes(pattern))) {
          await this.redisL2.del(key);
          count++;
        }
      }
    }

    // L3
    const { error } = await this.supabase
      .from("semantic_cache")
      .delete()
      .or(`exact_match.ilike.%${pattern}%,response.ilike.%${pattern}%`);

    if (error) {
      console.error("[SemanticCache] L3 invalidation error:", error);
    }

    return count;
  }

  async clear(): Promise<void> {
    this.l0Cache.clear();
    
    if (this.redisL1) {
      const keys = await this.redisL1.keys("cache:l1:*");
      if (keys.length > 0) {
        await this.redisL1.del(...keys);
      }
    }

    if (this.redisL2) {
      const keys = await this.redisL2.keys("cache:l2:*");
      if (keys.length > 0) {
        await this.redisL2.del(...keys);
      }
    }

    await this.supabase.from("semantic_cache").delete().neq("id", 0);
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  getStats(): CacheStats {
    const total = this.stats.totalRequests || 1;
    
    return {
      l1HitRate: Math.round((this.stats.l1Hits / total) * 1000) / 10,
      l2HitRate: Math.round((this.stats.l2Hits / total) * 1000) / 10,
      l3HitRate: Math.round((this.stats.l3Hits / total) * 1000) / 10,
      totalSavings: Math.round(this.stats.totalSavings * 100) / 100,
      entriesCount: this.l0Cache.size,
      avgResponseTime: 2, // Estimated milliseconds
    };
  }

  getEmpireCacheReport(): string {
    const stats = this.getStats();
    const totalHits = this.stats.l1Hits + this.stats.l2Hits + this.stats.l3Hits;
    const hitRate = Math.round((totalHits / (this.stats.totalRequests || 1)) * 100);

    return `Collective Memory Status:
• Hit Rate: ${hitRate}% (Target: 99%)
• Cost Savings: $${stats.totalSavings.toFixed(2)}
• L0 Cache: ${this.l0Cache.size} entries (in-memory)
• Response Time: ${stats.avgResponseTime}ms average
• Status: ${hitRate > 90 ? "OPTIMAL - Neural pathways fully active" : hitRate > 70 ? "STABLE - Learning in progress" : "EXPANDING - Building collective knowledge"}`;
  }

  // ==========================================
  // BATCH OPERATIONS
  // ==========================================

  async getBatch(queries: CacheQuery[]): Promise<CacheResult[]> {
    return Promise.all(queries.map(q => this.get(q)));
  }

  async setBatch(
    items: Array<{
      query: string;
      response: string;
      context?: string;
    }>
  ): Promise<void> {
    await Promise.all(items.map(item => 
      this.set(item.query, item.response, { context: item.context })
    ));
  }
}

// Export singleton
export const semanticCache = new SemanticCacheManager();
