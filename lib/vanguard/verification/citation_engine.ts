/**
 * lib/vanguard/verification/citation_engine.ts
 * =============================================
 * Citation Engine — three-tier verification pipeline.
 *
 * Tier 1: In-memory knowledge graph / site-content (instant, free)
 * Tier 3: Admin-corrected learnings from vanguard_learnings (fast, authoritative)
 * Tier 2: Web search (SerpStack free tier) — last resort, async
 *
 * Resolution order: T1 → T3 → T2 → Fail Gracefully
 * Every claim that reaches the user gets a CitationBadge.
 */

import {
  type Citation,
  type VerificationResult,
  VerificationTier,
  makeError,
  Ok,
  Err,
  type Result,
  type VanguardError,
} from "@/lib/vanguard/types";
import { logger } from "@/lib/vanguard/observability/logger";
import { getRateLimiter } from "@/lib/vanguard/observability/rate_limiter";
import { getCacheManager } from "@/lib/vanguard/observability/cache_manager";

// ════════════════════════════════════════════════════════════
// TIER 1: KNOWLEDGE GRAPH / SITE-CONTENT
// ════════════════════════════════════════════════════════════

/**
 * Shape of a Tier-1 knowledge entry.
 * Populated at startup from site-content.ts seed data
 * and vanguard_materials / vanguard_products tables.
 */
export interface KnowledgeEntry {
  readonly slug:      string;
  readonly nameAr:    string;
  readonly content:   string;       // full searchable text
  readonly category:  string;
  readonly tags:      string[];
  readonly confidence: number;
}

// In-memory store (filled by seedKnowledgeGraph() at startup)
const knowledgeGraph: Map<string, KnowledgeEntry> = new Map();

export function seedKnowledgeGraph(entries: KnowledgeEntry[]): void {
  for (const entry of entries) {
    knowledgeGraph.set(entry.slug, entry);
  }
  logger.info("[CitationEngine] Knowledge graph seeded", { count: knowledgeGraph.size });
}

function searchTier1(claim: string): Citation | null {
  const lower = claim.toLowerCase();
  let best: { entry: KnowledgeEntry; score: number } | null = null;

  for (const entry of knowledgeGraph.values()) {
    const text  = (entry.content + " " + entry.nameAr).toLowerCase();
    const words = lower.split(/\s+/).filter((w) => w.length > 2);
    if (words.length === 0) continue;
    const hits  = words.filter((w) => text.includes(w)).length;
    const score = hits / words.length;

    // Also check tag overlap
    const tagHits = entry.tags.filter((t) => lower.includes(t.toLowerCase())).length;
    const finalScore = score * 0.7 + (tagHits > 0 ? 0.3 : 0);

    if (finalScore > 0.4 && (!best || finalScore > best.score)) {
      best = { entry, score: finalScore };
    }
  }

  if (!best) return null;

  const excerpt = best.entry.content.slice(0, 200);
  return {
    id:         crypto.randomUUID(),
    tier:       VerificationTier.TIER1,
    source:     `knowledge_graph:${best.entry.slug}`,
    excerpt,
    claim,
    confidence: Math.min(0.98, best.entry.confidence * best.score + 0.4),
    verifiedAt: new Date().toISOString(),
    metadata:   { slug: best.entry.slug, category: best.entry.category },
  };
}

// ════════════════════════════════════════════════════════════
// TIER 3: ADMIN LEARNINGS (Supabase)
// ════════════════════════════════════════════════════════════

async function searchTier3(claim: string): Promise<Citation | null> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;

    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await db
      .from("vanguard_learnings")
      .select("id, claim, correction, evidence, confidence, domain")
      .eq("is_active", true)
      .textSearch("claim", claim, { type: "websearch", config: "arabic" })
      .order("confidence", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    const text = data.correction ?? data.claim;
    return {
      id:         crypto.randomUUID(),
      tier:       VerificationTier.TIER3,
      source:     `vanguard_learnings:${String(data.id)}`,
      excerpt:    String(text).slice(0, 200),
      claim,
      confidence: Number(data.confidence ?? 0.9),
      verifiedAt: new Date().toISOString(),
      metadata:   { domain: data.domain, learningId: data.id },
    };
  } catch (err) {
    logger.warn("[CitationEngine] Tier3 search failed", { error: String(err) });
    return null;
  }
}

// ════════════════════════════════════════════════════════════
// TIER 2: WEB SEARCH (SerpStack free tier)
// ════════════════════════════════════════════════════════════

interface SerpResult {
  title:   string;
  snippet: string;
  url:     string;
}

async function searchTier2(claim: string): Promise<Citation | null> {
  const apiKey = process.env.SERPSTACK_API_KEY;
  if (!apiKey) {
    logger.debug("[CitationEngine] SERPSTACK_API_KEY not set — skipping Tier 2");
    return null;
  }

  const limiter = getRateLimiter();
  const allowed = await limiter.check("serpstack");
  if (!allowed) {
    logger.warn("[CitationEngine] Tier 2 rate-limited — skipping");
    return null;
  }

  try {
    const query    = encodeURIComponent(`أزينث للأثاث ${claim}`);
    const url      = `http://api.serpstack.com/search?access_key=${apiKey}&query=${query}&num=3&language=ar`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) return null;

    const json = (await response.json()) as { organic_results?: SerpResult[] };
    const results: SerpResult[] = json.organic_results ?? [];

    if (results.length === 0) return null;

    const top = results[0];
    return {
      id:         crypto.randomUUID(),
      tier:       VerificationTier.TIER2,
      source:     top.url,
      excerpt:    top.snippet.slice(0, 200),
      claim,
      confidence: 0.65,  // web search is less authoritative than T1/T3
      verifiedAt: new Date().toISOString(),
      metadata:   { title: top.title, url: top.url },
    };
  } catch (err) {
    logger.warn("[CitationEngine] Tier 2 web search failed", { error: String(err) });
    return null;
  }
}

// ════════════════════════════════════════════════════════════
// VERIFICATION PIPELINE
// ════════════════════════════════════════════════════════════

async function runVerificationPipeline(
  claim: string
): Promise<{ citation: Citation | null; tier: VerificationTier }> {
  // T1 — synchronous
  const t1 = searchTier1(claim);
  if (t1 && t1.confidence > 0.6) return { citation: t1, tier: VerificationTier.TIER1 };

  // T3 — async DB
  const t3 = await searchTier3(claim);
  if (t3 && t3.confidence > 0.7) return { citation: t3, tier: VerificationTier.TIER3 };

  // T2 — web search (slowest, use T1 as fallback if T2 fails)
  const t2 = await searchTier2(claim);
  if (t2) return { citation: t2, tier: VerificationTier.TIER2 };

  // Return best available even if confidence is low
  if (t1) return { citation: t1, tier: VerificationTier.TIER1 };
  if (t3) return { citation: t3, tier: VerificationTier.TIER3 };

  return { citation: null, tier: VerificationTier.FAILED };
}

// ════════════════════════════════════════════════════════════
// PERSIST VERIFICATION LOG
// ════════════════════════════════════════════════════════════

async function persistVerificationLog(
  sessionId:     string,
  result:        VerificationResult
): Promise<void> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await db.from("vanguard_verification_log").insert({
      session_id:    sessionId,
      claim:         result.claim,
      tier_used:     result.tier,
      verified:      result.verified,
      confidence:    result.confidence,
      citations:     result.citations,
      latency_ms:    result.latencyMs,
      failure_reason: result.failureReason ?? null,
    });
  } catch (err) {
    logger.warn("[CitationEngine] Failed to persist verification log", { error: String(err) });
  }
}

// ════════════════════════════════════════════════════════════
// CITATION ENGINE CLASS
// ════════════════════════════════════════════════════════════

export class CitationEngine {
  /**
   * Verify a single claim through the three-tier pipeline.
   * Results are cached (5 min TTL) to avoid redundant API calls.
   */
  async verify(
    claim:     string,
    sessionId: string = "anon"
  ): Promise<VerificationResult> {
    const cacheKey = `citation:${claim.slice(0, 120)}`;
    const cache    = getCacheManager();

    // L1/L2 cache hit
    const cached = await cache.get<VerificationResult>(cacheKey);
    if (cached) {
      logger.debug("[CitationEngine] Cache hit", { claim: claim.slice(0, 60) });
      return { ...cached, latencyMs: 0 };
    }

    const start = Date.now();
    const { citation, tier } = await runVerificationPipeline(claim);
    const latencyMs = Date.now() - start;

    const result: VerificationResult = {
      claim,
      verified:    citation !== null && citation.confidence >= 0.5,
      confidence:  citation?.confidence ?? 0,
      tier,
      citations:   citation ? [citation] : [],
      latencyMs,
      failureReason: citation === null ? "no_source_found" : undefined,
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, result, 300);

    // Async persist (non-blocking)
    void persistVerificationLog(sessionId, result);

    logger.info("[CitationEngine] Verification complete", {
      claim:      claim.slice(0, 60),
      tier,
      verified:   result.verified,
      confidence: result.confidence,
      latencyMs,
    });

    return result;
  }

  /**
   * Verify multiple claims in parallel (max 5 concurrent).
   */
  async verifyBatch(
    claims:    string[],
    sessionId: string = "anon"
  ): Promise<VerificationResult[]> {
    const BATCH_SIZE = 5;
    const results: VerificationResult[] = [];

    for (let i = 0; i < claims.length; i += BATCH_SIZE) {
      const batch = claims.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((c) => this.verify(c, sessionId))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Annotate a response text with inline citation markers.
   * E.g. "خشب البلوط متين [T1]" where [T1] indicates Tier 1 verified.
   */
  annotateResponse(
    response:     string,
    verifications: VerificationResult[]
  ): string {
    let annotated = response;
    for (const v of verifications) {
      if (!v.verified || v.citations.length === 0) continue;
      const citation = v.citations[0];
      const badge    = this.tierBadge(citation.tier);
      // Find the claim in the response and append badge
      const idx = annotated.indexOf(v.claim.slice(0, 30));
      if (idx !== -1) {
        const end = idx + v.claim.slice(0, 30).length;
        annotated = annotated.slice(0, end) + ` ${badge}` + annotated.slice(end);
      }
    }
    return annotated;
  }

  tierBadge(tier: VerificationTier): string {
    switch (tier) {
      case VerificationTier.TIER1: return "✓";
      case VerificationTier.TIER2: return "⊕";
      case VerificationTier.TIER3: return "★";
      case VerificationTier.FAILED: return "";
    }
  }
}

// ════════════════════════════════════════════════════════════
// SINGLETON
// ════════════════════════════════════════════════════════════

let _citationEngine: CitationEngine | null = null;

export function getCitationEngine(): CitationEngine {
  if (!_citationEngine) _citationEngine = new CitationEngine();
  return _citationEngine;
}
