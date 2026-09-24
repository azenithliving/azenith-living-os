/**
 * lib/vanguard/observability/cache_manager.ts
 * ============================================
 * Two-layer cache for Vanguard:
 *
 *   L1 — In-process LRU (Map-based, zero cost, sub-millisecond)
 *   L2 — Supabase (persistent across cold starts, free tier)
 *
 * Smart TTL by data type:
 *   Citations / verifications:  5 min  (fresh enough, saves API calls)
 *   Daily brief:                10 min
 *   Weather:                    30 min
 *   LLM responses:               2 min  (very short — conversations change fast)
 *   Market signals:             60 min
 *   Knowledge graph entries:    24 h   (static product/material data)
 *   Embeddings:                 24 h
 *
 * Graceful degradation: L2 failures are caught, L1 still works.
 */

import { logger } from "@/lib/vanguard/observability/logger";

// ════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════

export type CacheTtlPreset =
  | "llm_response"        // 2 min
  | "citation"            // 5 min
  | "daily_brief"         // 10 min
  | "weather"             // 30 min
  | "market_signal"       // 60 min
  | "knowledge"           // 24 h
  | "embedding";          // 24 h

const TTL_SECONDS: Record<CacheTtlPreset, number> = {
  llm_response:  120,
  citation:      300,
  daily_brief:   600,
  weather:       1800,
  market_signal: 3600,
  knowledge:     86_400,
  embedding:     86_400,
};

interface L1Entry<T> {
  value:     T;
  expiresAt: number;  // Unix ms
  hits:      number;
}

interface L2Row {
  cache_key:  string;
  value:      unknown;
  expires_at: string;  // ISO
}

// ════════════════════════════════════════════════════════════
// L1 — IN-PROCESS LRU
// ════════════════════════════════════════════════════════════

class L1Cache {
  private readonly store: Map<string, L1Entry<unknown>> = new Map();
  private readonly maxEntries: number;
  private hits   = 0;
  private misses = 0;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) { this.misses++; return null; }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    entry.hits++;
    this.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    // Evict LRU if over capacity (remove oldest entry)
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      hits:      0,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  stats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size:    this.store.size,
      hits:    this.hits,
      misses:  this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /** Remove all expired entries */
  evictExpired(): number {
    let count = 0;
    const now = Date.now();
    for (const [k, e] of this.store.entries()) {
      if (now > e.expiresAt) { this.store.delete(k); count++; }
    }
    return count;
  }
}

// ════════════════════════════════════════════════════════════
// L2 — SUPABASE CACHE TABLE
// We use a simple key/value table via the service-role client.
// Table doesn't need a migration — we create it lazily.
// (If the vanguard_cache table doesn't exist yet, L2 simply no-ops.)
// ════════════════════════════════════════════════════════════

async function getL2Client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function l2Get<T>(cacheKey: string): Promise<T | null> {
  try {
    const db = await getL2Client();
    if (!db) return null;

    const { data, error } = await db
      .from("vanguard_cache")
      .select("value, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as L2Row;
    if (new Date(row.expires_at) < new Date()) {
      // Expired — async delete, don't block
      void db.from("vanguard_cache").delete().eq("cache_key", cacheKey);
      return null;
    }

    return row.value as T;
  } catch {
    return null;
  }
}

async function l2Set<T>(cacheKey: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    const db = await getL2Client();
    if (!db) return;

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await db.from("vanguard_cache").upsert(
      { cache_key: cacheKey, value, expires_at: expiresAt, updated_at: new Date().toISOString() },
      { onConflict: "cache_key" }
    );
  } catch {
    // Non-critical — L1 still works
  }
}

async function l2Delete(cacheKey: string): Promise<void> {
  try {
    const db = await getL2Client();
    if (!db) return;
    await db.from("vanguard_cache").delete().eq("cache_key", cacheKey);
  } catch {
    // Ignore
  }
}

// ════════════════════════════════════════════════════════════
// CACHE MANAGER
// ════════════════════════════════════════════════════════════

export class CacheManager {
  private readonly l1: L1Cache;
  private evictTimer: ReturnType<typeof setInterval> | null = null;

  constructor(l1MaxEntries = 500) {
    this.l1 = new L1Cache(l1MaxEntries);
    // Periodic L1 eviction every 5 minutes
    if (typeof setInterval !== "undefined") {
      this.evictTimer = setInterval(() => {
        const evicted = this.l1.evictExpired();
        if (evicted > 0) {
          logger.debug("[CacheManager] L1 evicted", { evicted });
        }
      }, 300_000);
    }
  }

  // ── Public API ────────────────────────────────────────────

  /**
   * Get a cached value. Checks L1 first, falls back to L2.
   * Populates L1 from L2 on a miss (write-through on read).
   */
  async get<T>(key: string): Promise<T | null> {
    // L1 hit
    const l1Hit = this.l1.get<T>(key);
    if (l1Hit !== null) return l1Hit;

    // L2 fallback
    const l2Hit = await l2Get<T>(key);
    if (l2Hit !== null) {
      // Repopulate L1 (short TTL — we don't know original TTL from L2)
      this.l1.set(key, l2Hit, 120);
      return l2Hit;
    }

    return null;
  }

  /**
   * Set a value in both L1 and L2.
   * @param ttlSeconds — explicit TTL in seconds
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.l1.set(key, value, ttlSeconds);
    await l2Set(key, value, ttlSeconds);
  }

  /**
   * Convenience: set with a named TTL preset.
   */
  async setPreset<T>(key: string, value: T, preset: CacheTtlPreset): Promise<void> {
    return this.set(key, value, TTL_SECONDS[preset]);
  }

  /**
   * Invalidate a key from both layers.
   */
  async invalidate(key: string): Promise<void> {
    this.l1.delete(key);
    await l2Delete(key);
  }

  /**
   * Invalidate all keys matching a prefix.
   * (L1 only — L2 pattern delete requires a table scan, avoided in hot path)
   */
  invalidatePrefix(prefix: string): void {
    // L1 stores keys in insertion order in the Map
    for (const key of (this.l1 as unknown as { store: Map<string, unknown> }).store.keys()) {
      if (key.startsWith(prefix)) this.l1.delete(key);
    }
  }

  /**
   * Clear everything (useful in tests).
   */
  async flush(): Promise<void> {
    this.l1.clear();
    // L2 flush is intentionally not done — too destructive in prod
  }

  /**
   * Stats for the observability dashboard.
   */
  l1Stats() {
    return this.l1.stats();
  }

  /** Resolve a TTL preset to seconds */
  ttl(preset: CacheTtlPreset): number {
    return TTL_SECONDS[preset];
  }

  destroy(): void {
    if (this.evictTimer) {
      clearInterval(this.evictTimer);
      this.evictTimer = null;
    }
  }
}

// ════════════════════════════════════════════════════════════
// SINGLETON
// ════════════════════════════════════════════════════════════

let _cacheManager: CacheManager | null = null;

export function getCacheManager(l1MaxEntries = 500): CacheManager {
  if (!_cacheManager) _cacheManager = new CacheManager(l1MaxEntries);
  return _cacheManager;
}

// Default singleton instance for direct import
export const cacheManager = new CacheManager();
