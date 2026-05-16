/**
 * Rate Limiting - Multi-tier Redis-based Rate Limiter
 * Using Upstash Redis with @upstash/ratelimit
 *
 * Tier 1 - General API: 100 requests per minute per IP
 * Tier 2 - Sensitive API: 20 requests per minute per IP
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

// Check if Redis credentials are available
const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

const isRedisConfigured = Boolean(redisUrl && redisToken);

// Initialize Redis client only if credentials are available
const redis = isRedisConfigured
  ? new Redis({
      url: redisUrl!,
      token: redisToken!,
    })
  : null;

// General API rate limiter: 100 requests per minute per IP
export const generalRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1m"),
      analytics: true,
      prefix: "ratelimit:general",
    })
  : null;

// Sensitive API rate limiter: 20 requests per minute per IP
export const sensitiveRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1m"),
      analytics: true,
      prefix: "ratelimit:sensitive",
    })
  : null;

// Legacy export for backward compatibility (uses general limiter)
export const rateLimiter = generalRateLimiter;

/**
 * Get client IP from NextRequest
 */
export function getClientIP(request: NextRequest): string {
  // Try to get IP from headers
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  // Fallback to a default (for development)
  return "unknown";
}

/** Circuit breaker: disable Redis rate limiting after quota/connection failures */
let redisCircuitOpenUntil = 0;
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000;

function isRedisCircuitOpen(): boolean {
  return Date.now() < redisCircuitOpenUntil;
}

function openRedisCircuit(reason: string): void {
  redisCircuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  console.warn(`[RateLimit] Redis circuit open for ${CIRCUIT_COOLDOWN_MS / 1000}s: ${reason}`);
}

function isRedisQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("max requests limit exceeded") ||
    message.includes("ERR max requests") ||
    message.includes("UpstashError")
  );
}

export type RateLimitResult = {
  success: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
  degraded?: boolean;
};

/**
 * Apply rate limit safely — fail open when Redis is down or over quota.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitResult> {
  if (!limiter || !isRedisConfigured || isRedisCircuitOpen()) {
    return { success: true, degraded: true };
  }

  if (process.env.RATE_LIMIT_DISABLED === "true") {
    return { success: true, degraded: true };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    if (isRedisQuotaError(error)) {
      openRedisCircuit("quota exceeded");
    } else {
      console.error("[RateLimit] Redis error, allowing request:", error);
    }
    return { success: true, degraded: true };
  }
}

/**
 * Check if rate limiting is configured and active
 */
export function isRateLimitingEnabled(): boolean {
  return isRedisConfigured && !isRedisCircuitOpen() && process.env.RATE_LIMIT_DISABLED !== "true";
}

/**
 * Protected API paths that need rate limiting
 */
export const PROTECTED_PATHS = [
  "/api/pexels",
  "/api/room-sections",
  "/api/curate-images",
  "/api/elite-gallery",
];

/**
 * Sensitive API paths with stricter rate limiting
 */
export const SENSITIVE_PATHS = [
  "/api/content-generator",
  "/api/enhance-image",
];

/**
 * Check if a path should be rate limited
 */
export function shouldRateLimit(pathname: string): {
  shouldLimit: boolean;
  isSensitive: boolean;
} {
  // Check sensitive paths first (more specific)
  if (SENSITIVE_PATHS.some((path) => pathname.startsWith(path))) {
    return { shouldLimit: true, isSensitive: true };
  }

  // Check protected paths
  if (PROTECTED_PATHS.some((path) => pathname.startsWith(path))) {
    return { shouldLimit: true, isSensitive: false };
  }

  return { shouldLimit: false, isSensitive: false };
}

/**
 * Check if a path should be skipped (static files, etc.)
 */
export function shouldSkipRateLimit(pathname: string): boolean {
  // Skip static files
  if (pathname.startsWith("/public")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/static")) return true;

  // Skip non-API routes (except for specific protections)
  if (!pathname.startsWith("/api/")) return true;

  return false;
}
