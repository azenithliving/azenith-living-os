/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – Reranker
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 2: Task 4 – Semantic reranking post-retrieval
 * 
 * Reranks search results by combining multiple signals:
 * 1. Vector similarity (from initial search)
 * 2. Recency (newer memories weighted higher)
 * 3. Domain relevance (matching context domain)
 * 4. Entity type priority (learnings > beliefs > memories)
 * 5. Keyword overlap (BM25-style lexical matching)
 * 
 * Final score = weighted sum of normalized signals.
 */

import { logger } from "@/lib/vanguard/observability/logger";
import type { VectorSearchResult } from "./vector_store";

// ─── Configuration ───────────────────────────────────────────────────────────

const WEIGHTS = {
  similarity: 0.4, // Vector similarity (primary signal)
  recency: 0.15, // Time decay
  domain: 0.2, // Domain match
  entityType: 0.15, // Entity priority
  keyword: 0.1, // Lexical overlap
};

const ENTITY_TYPE_PRIORITY: Record<string, number> = {
  learning: 1.0, // Admin-corrected facts (highest priority)
  belief: 0.8, // Agent beliefs
  memory: 0.6, // Session memories
  lead: 0.4, // CRM data
  product: 0.5, // Catalog data
  material: 0.5,
  document: 0.3,
};

const RECENCY_HALF_LIFE_DAYS = 30; // Exponential decay: 50% weight after 30 days

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RerankOptions {
  query: string;
  contextDomain?: string; // 'sales','operations','psychology','technical','cultural','general'
  boostRecent?: boolean; // Enable recency boosting (default: true)
  boostDomain?: boolean; // Enable domain matching (default: true)
  customWeights?: Partial<typeof WEIGHTS>;
}

export interface RankedResult extends VectorSearchResult {
  finalScore: number;
  scoreBreakdown: {
    similarity: number;
    recency: number;
    domain: number;
    entityType: number;
    keyword: number;
  };
}

// ─── Main: Rerank Results ────────────────────────────────────────────────────

export function rerankResults(
  results: VectorSearchResult[],
  options: RerankOptions
): RankedResult[] {
  if (results.length === 0) return [];

  const weights = { ...WEIGHTS, ...(options.customWeights || {}) };
  const boostRecent = options.boostRecent !== false;
  const boostDomain = options.boostDomain !== false;

  const rankedResults: RankedResult[] = results.map((result) => {
    // Signal 1: Vector similarity (already normalized 0-1)
    const similarityScore = result.similarity;

    // Signal 2: Recency score (exponential decay)
    const recencyScore = boostRecent ? calculateRecencyScore(result.created_at) : 0.5;

    // Signal 3: Domain relevance
    const domainScore = boostDomain && options.contextDomain
      ? calculateDomainScore(result, options.contextDomain)
      : 0.5;

    // Signal 4: Entity type priority
    const entityTypeScore = ENTITY_TYPE_PRIORITY[result.entity_type] || 0.3;

    // Signal 5: Keyword overlap (BM25-lite)
    const keywordScore = calculateKeywordScore(result.content, options.query);

    // Weighted sum
    const finalScore =
      weights.similarity * similarityScore +
      weights.recency * recencyScore +
      weights.domain * domainScore +
      weights.entityType * entityTypeScore +
      weights.keyword * keywordScore;

    return {
      ...result,
      finalScore,
      scoreBreakdown: {
        similarity: similarityScore,
        recency: recencyScore,
        domain: domainScore,
        entityType: entityTypeScore,
        keyword: keywordScore,
      },
    };
  });

  // Sort by finalScore descending
  rankedResults.sort((a, b) => b.finalScore - a.finalScore);

  logger.debug("[Reranker] Reranking complete", {
    inputCount: results.length,
    topScore: rankedResults[0]?.finalScore,
    topEntity: rankedResults[0]?.entity_type,
  });

  return rankedResults;
}

// ─── Helper: Calculate Recency Score ─────────────────────────────────────────

function calculateRecencyScore(created_at: string): number {
  const now = Date.now();
  const createdTime = new Date(created_at).getTime();
  const ageInDays = (now - createdTime) / (1000 * 60 * 60 * 24);

  // Exponential decay: score = 2^(-age/halfLife)
  const score = Math.pow(2, -ageInDays / RECENCY_HALF_LIFE_DAYS);
  return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
}

// ─── Helper: Calculate Domain Score ──────────────────────────────────────────

function calculateDomainScore(result: VectorSearchResult, contextDomain: string): number {
  const metadataDomain = result.metadata?.domain as string | undefined;
  if (!metadataDomain) return 0.5; // Neutral if no domain metadata

  // Exact match
  if (metadataDomain === contextDomain) return 1.0;

  // Partial match heuristics
  if (contextDomain === "general") return 0.7; // General context accepts most domains
  if (metadataDomain === "general") return 0.6; // General memories useful everywhere

  // Related domains
  const relatedDomains: Record<string, string[]> = {
    sales: ["operations", "psychology", "cultural"],
    operations: ["sales", "technical"],
    psychology: ["sales", "cultural"],
    technical: ["operations"],
    cultural: ["sales", "psychology"],
  };

  if (relatedDomains[contextDomain]?.includes(metadataDomain)) {
    return 0.7;
  }

  return 0.3; // Unrelated domain
}

// ─── Helper: Calculate Keyword Score (BM25-lite) ─────────────────────────────

function calculateKeywordScore(content: string, query: string): number {
  const contentLower = content.toLowerCase();
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2); // Ignore short words

  if (queryTerms.length === 0) return 0.5;

  let matchCount = 0;
  for (const term of queryTerms) {
    if (contentLower.includes(term)) {
      matchCount++;
    }
  }

  const score = matchCount / queryTerms.length;
  return score;
}

// ─── Helper: Filter by Minimum Score ─────────────────────────────────────────

export function filterByMinScore(
  rankedResults: RankedResult[],
  minScore: number
): RankedResult[] {
  return rankedResults.filter((r) => r.finalScore >= minScore);
}

// ─── Helper: Get Top N Results ───────────────────────────────────────────────

export function getTopN(rankedResults: RankedResult[], n: number): RankedResult[] {
  return rankedResults.slice(0, n);
}

// ─── Helper: Diversity Reranking (MMR-style) ─────────────────────────────────

export function diversifyResults(
  rankedResults: RankedResult[],
  lambda: number = 0.7 // Balance relevance (lambda) vs diversity (1-lambda)
): RankedResult[] {
  if (rankedResults.length <= 1) return rankedResults;

  const diversified: RankedResult[] = [];
  const remaining = [...rankedResults];

  // Start with top result
  diversified.push(remaining.shift()!);

  // Iteratively select results that balance relevance and diversity
  while (remaining.length > 0) {
    let maxScore = -Infinity;
    let maxIndex = 0;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];

      // Relevance score
      const relevance = candidate.finalScore;

      // Diversity score (minimum similarity to already selected)
      let minSimilarity = Infinity;
      for (const selected of diversified) {
        const similarity = candidate.similarity; // Simplified: use vector similarity
        minSimilarity = Math.min(minSimilarity, similarity);
      }
      const diversity = 1 - minSimilarity;

      // MMR score
      const mmrScore = lambda * relevance + (1 - lambda) * diversity;

      if (mmrScore > maxScore) {
        maxScore = mmrScore;
        maxIndex = i;
      }
    }

    diversified.push(remaining.splice(maxIndex, 1)[0]);
  }

  return diversified;
}

// ─── Helper: Serialize Ranked Results for Logs ───────────────────────────────

export function serializeRankedResults(results: RankedResult[]): string {
  let output = `Ranked Results (${results.length}):\n`;

  results.slice(0, 10).forEach((r, i) => {
    output += `\n${i + 1}. [${r.entity_type}] ${r.content.slice(0, 80)}...\n`;
    output += `   Final Score: ${r.finalScore.toFixed(3)} (sim=${r.scoreBreakdown.similarity.toFixed(2)}, `;
    output += `rec=${r.scoreBreakdown.recency.toFixed(2)}, dom=${r.scoreBreakdown.domain.toFixed(2)}, `;
    output += `ent=${r.scoreBreakdown.entityType.toFixed(2)}, kw=${r.scoreBreakdown.keyword.toFixed(2)})\n`;
  });

  if (results.length > 10) {
    output += `\n... and ${results.length - 10} more results`;
  }

  return output;
}
