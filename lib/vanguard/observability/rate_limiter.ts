/**
 * lib/vanguard/observability/rate_limiter.ts
 * ===========================================
 * Token-Bucket Rate Limiter for all external APIs.
 *
 * Each API has its own bucket with:
 *   - capacity:       max tokens in the bucket
 *   - refillRate:     tokens added per second
 *   - consumeAmount:  tokens consumed per call
 *
 * Respects Retry-After and X-RateLimit-Reset response headers.
 * Persists nothing — in-process only (Vercel function scope).
 * For distributed rate limiting, swap the bucket store for Upstash Redis
 * (already in package.json as @upstash/ratelimit).
 */

import { logger } from "@/lib/vanguard/observability/logger";

// ════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════

export interface BucketConfig {
  /** Total token capacity */
  capacity:      number;
  /** Tokens added per second (refill rate) */
  refillRate:    number;
  /** Tokens consumed per API call (default 1) */
  consumeAmount: number;
  /** Minimum milliseconds between calls (enforced on top of token bucket) */
  minIntervalMs?: number;
}

interface Bucket {
  tokens:     number;
  lastRefill: number;   // Unix ms
  lastCall:   number;   // Unix ms
  blocked:    boolean;  // true while in a Retry-After window
  blockedUntil: number; // Unix ms
  callCount:  number;
  errorCount: number;
}

// ════════════════════════════════════════════════════════════
// API PRESETS
// Free-tier limits for each external API used by Vanguard.
// ════════════════════════════════════════════════════════════

export const API_CONFIGS: Record<string, BucketConfig> = {
  // Groq — free tier: 6000 req/day, 30 req/min
  groq: {
    capacity:      30,
    refillRate:    0.5,   // 30 / 60s = 0.5 tokens/s
    consumeAmount: 1,
    minIntervalMs: 100,
  },
  // Gemini — free tier: 60 req/min (Gemini 2.0 Flash)
  gemini: {
    capacity:      60,
    refillRate:    1.0,
    consumeAmount: 1,
    minIntervalMs: 50,
  },
  // Hugging Face Inference API — free tier: ~10 req/s
  huggingface: {
    capacity:      10,
    refillRate:    10,
    consumeAmount: 1,
    minIntervalMs: 100,
  },
  // SerpStack — free: 100 req/month → ~0.00038 req/s
  serpstack: {
    capacity:      5,
    refillRate:    0.000385,  // ~100/month
    consumeAmount: 1,
    minIntervalMs: 2000,
  },
  // Resend email — free: 100 emails/day
  resend: {
    capacity:      10,
    refillRate:    0.00116,   // 100/day
    consumeAmount: 1,
    minIntervalMs: 500,
  },
  // Supabase REST — generous limits, no strict cap
  supabase: {
    capacity:      500,
    refillRate:    50,
    consumeAmount: 1,
    minIntervalMs: 10,
  },
  // WhatsApp Business API — 1000 free conversations/month
  whatsapp: {
    capacity:      20,
    refillRate:    0.01,
    consumeAmount: 1,
    minIntervalMs: 1000,
  },
  // CraftMyPDF — free: 50 PDFs/month
  craftmypdf: {
    capacity:      5,
    refillRate:    0.0000193,
    consumeAmount: 1,
    minIntervalMs: 5000,
  },
  // Generic fallback
  default: {
    capacity:      20,
    refillRate:    2,
    consumeAmount: 1,
    minIntervalMs: 200,
  },
};

// ════════════════════════════════════════════════════════════
// BUCKET OPERATIONS
// ════════════════════════════════════════════════════════════

function makeBucket(config: BucketConfig): Bucket {
  return {
    tokens:       config.capacity,
    lastRefill:   Date.now(),
    lastCall:     0,
    blocked:      false,
    blockedUntil: 0,
    callCount:    0,
    errorCount:   0,
  };
}

function refill(bucket: Bucket, config: BucketConfig): void {
  const now     = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000;  // seconds
  const added   = elapsed * config.refillRate;
  bucket.tokens = Math.min(config.capacity, bucket.tokens + added);
  bucket.lastRefill = now;
}

// ════════════════════════════════════════════════════════════
// RATE LIMITER CLASS
// ════════════════════════════════════════════════════════════

export class RateLimiter {
  private readonly buckets: Map<string, Bucket> = new Map();
  private readonly configs: Map<string, BucketConfig> = new Map();

  constructor(overrides: Record<string, BucketConfig> = {}) {
    // Merge defaults with overrides
    for (const [api, cfg] of Object.entries({ ...API_CONFIGS, ...overrides })) {
      this.configs.set(api, cfg);
    }
  }

  // ── Private helpers ──────────────────────────────────────

  private getBucket(api: string): Bucket {
    if (!this.buckets.has(api)) {
      const cfg = this.configs.get(api) ?? API_CONFIGS.default;
      this.buckets.set(api, makeBucket(cfg));
    }
    return this.buckets.get(api)!;
  }

  private getConfig(api: string): BucketConfig {
    return this.configs.get(api) ?? API_CONFIGS.default;
  }

  // ── Public API ───────────────────────────────────────────

  /**
   * Check if a call to `api` is allowed RIGHT NOW.
   * Consumes one token if allowed.
   * Returns true (allowed) or false (rate-limited).
   */
  async check(api: string): Promise<boolean> {
    const bucket = this.getBucket(api);
    const config = this.getConfig(api);
    const now    = Date.now();

    // Retry-After block
    if (bucket.blocked && now < bucket.blockedUntil) {
      logger.warn("[RateLimiter] Blocked (Retry-After)", {
        api,
        blockedUntilMs: bucket.blockedUntil - now,
      });
      return false;
    }
    bucket.blocked = false;

    // Minimum interval enforcement
    if (config.minIntervalMs && (now - bucket.lastCall) < config.minIntervalMs) {
      logger.debug("[RateLimiter] Min interval not elapsed", {
        api,
        remainingMs: config.minIntervalMs - (now - bucket.lastCall),
      });
      return false;
    }

    // Refill bucket
    refill(bucket, config);

    // Check available tokens
    if (bucket.tokens < config.consumeAmount) {
      logger.warn("[RateLimiter] Token bucket exhausted", {
        api,
        tokens: bucket.tokens,
        required: config.consumeAmount,
      });
      return false;
    }

    // Consume
    bucket.tokens  -= config.consumeAmount;
    bucket.lastCall = now;
    bucket.callCount++;
    return true;
  }

  /**
   * Wait until the rate limit allows a call, with exponential backoff.
   * Will not wait more than `maxWaitMs`.
   */
  async waitAndCheck(api: string, maxWaitMs = 10_000): Promise<boolean> {
    const start = Date.now();
    let attempt = 0;

    while (Date.now() - start < maxWaitMs) {
      const allowed = await this.check(api);
      if (allowed) return true;

      attempt++;
      const waitMs = Math.min(200 * Math.pow(2, attempt - 1), 2000);
      logger.debug("[RateLimiter] Backing off", { api, waitMs, attempt });
      await new Promise((r) => setTimeout(r, waitMs));
    }

    logger.warn("[RateLimiter] waitAndCheck timed out", { api, maxWaitMs });
    return false;
  }

  /**
   * Call after receiving a 429 response.
   * Reads Retry-After header and blocks the bucket until then.
   */
  handleRateLimitResponse(api: string, headers: Headers): void {
    const retryAfter = headers.get("Retry-After") ?? headers.get("x-ratelimit-reset");
    const bucket     = this.getBucket(api);

    if (retryAfter) {
      const seconds     = parseInt(retryAfter, 10);
      const blockedUntil = isNaN(seconds)
        ? Date.now() + 60_000
        : Date.now() + seconds * 1000;
      bucket.blocked      = true;
      bucket.blockedUntil = blockedUntil;
      bucket.errorCount++;
      logger.warn("[RateLimiter] 429 received — blocking", { api, seconds, blockedUntil });
    } else {
      // Default 60s block
      bucket.blocked      = true;
      bucket.blockedUntil = Date.now() + 60_000;
      bucket.errorCount++;
      logger.warn("[RateLimiter] 429 received — default 60s block", { api });
    }
  }

  /**
   * Get stats for all tracked APIs (for the cost dashboard).
   */
  getStats(): Record<string, {
    callCount:  number;
    errorCount: number;
    tokens:     number;
    capacity:   number;
    blocked:    boolean;
  }> {
    const stats: ReturnType<RateLimiter["getStats"]> = {};
    for (const [api, bucket] of this.buckets.entries()) {
      const config   = this.getConfig(api);
      refill(bucket, config);  // update before reporting
      stats[api] = {
        callCount:  bucket.callCount,
        errorCount: bucket.errorCount,
        tokens:     Math.floor(bucket.tokens),
        capacity:   config.capacity,
        blocked:    bucket.blocked,
      };
    }
    return stats;
  }

  /** Reset a specific bucket (useful in tests) */
  reset(api: string): void {
    const config = this.getConfig(api);
    this.buckets.set(api, makeBucket(config));
  }
}

// ════════════════════════════════════════════════════════════
// SINGLETON
// ════════════════════════════════════════════════════════════

let _rateLimiter: RateLimiter | null = null;

export function getRateLimiter(overrides?: Record<string, BucketConfig>): RateLimiter {
  if (!_rateLimiter) _rateLimiter = new RateLimiter(overrides);
  return _rateLimiter;
}

// Default singleton instance for direct import
export const rateLimiter = getRateLimiter();
