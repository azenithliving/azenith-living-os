/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – Pattern Extractor
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 1: Task 8 – Extract win/loss patterns from pipeline data
 * 
 * Analyzes historical pipeline data to identify:
 * - Win patterns (what led to closed-won deals)
 * - Loss patterns (what led to lost opportunities)
 * - Neutral patterns (common behaviors without clear outcome signal)
 * 
 * Used by reflection_engine.ts to feed strategy_synthesizer.ts
 */

import type { Pipeline } from "@/lib/vanguard/types";

// ─── Pattern Types ───────────────────────────────────────────────────────────

export interface Pattern {
  type: "win" | "loss" | "neutral";
  description: string;
  confidence: number; // 0-1
  occurrences: number;
  examples: string[]; // Pipeline IDs demonstrating this pattern
  signals: string[]; // What signals contributed to this pattern
}

export interface PatternExtractionResult {
  winPatterns: Pattern[];
  lossPatterns: Pattern[];
  neutralPatterns: Pattern[];
  totalAnalyzed: number;
  extractedAt: string;
}

// ─── Pattern Detectors ───────────────────────────────────────────────────────

interface PatternDetector {
  name: string;
  detect: (pipelines: Pipeline[]) => Pattern | null;
}

const WIN_DETECTORS: PatternDetector[] = [
  {
    name: "fast_conversion",
    detect: (pipelines) => {
      const won = pipelines.filter((p) => p.status === "closed_won");
      const fastWins = won.filter((p) => {
        const created = new Date(p.created_at);
        const closed = p.closed_at ? new Date(p.closed_at) : new Date();
        const daysDiff = (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7;
      });

      if (fastWins.length < 2) return null;

      return {
        type: "win",
        description: "Fast conversion (≤7 days from lead to closed-won)",
        confidence: Math.min(0.95, fastWins.length / won.length),
        occurrences: fastWins.length,
        examples: fastWins.slice(0, 3).map((p) => p.id),
        signals: ["quick_response", "clear_need", "decision_maker_present"],
      };
    },
  },
  {
    name: "high_value_repeat",
    detect: (pipelines) => {
      const won = pipelines.filter((p) => p.status === "closed_won");
      const highValue = won.filter((p) => (p.value || 0) >= 50000);

      if (highValue.length < 2) return null;

      return {
        type: "win",
        description: "High-value deals (≥50k) consistently won",
        confidence: Math.min(0.9, highValue.length / won.length),
        occurrences: highValue.length,
        examples: highValue.slice(0, 3).map((p) => p.id),
        signals: ["enterprise_tier", "multi_stakeholder", "detailed_requirements"],
      };
    },
  },
  {
    name: "follow_up_persistence",
    detect: (pipelines) => {
      const won = pipelines.filter((p) => p.status === "closed_won");
      // Heuristic: won deals with ≥3 follow-up activities (we don't have activity table yet,
      // so we infer from stage progression: qualified → proposal → negotiation → closed)
      const multiStage = won.filter(
        (p) => p.stage && ["proposal", "negotiation", "closed_won"].includes(p.stage)
      );

      if (multiStage.length < 2) return null;

      return {
        type: "win",
        description: "Persistent follow-up through multiple stages wins deals",
        confidence: Math.min(0.85, multiStage.length / won.length),
        occurrences: multiStage.length,
        examples: multiStage.slice(0, 3).map((p) => p.id),
        signals: ["multiple_touchpoints", "proposal_sent", "negotiation_engaged"],
      };
    },
  },
];

const LOSS_DETECTORS: PatternDetector[] = [
  {
    name: "pricing_objection",
    detect: (pipelines) => {
      const lost = pipelines.filter((p) => p.status === "closed_lost");
      // Heuristic: lost deals with high value (pricing shock) or lost in negotiation stage
      const pricingLost = lost.filter(
        (p) => p.stage === "negotiation" || (p.value && p.value >= 100000)
      );

      if (pricingLost.length < 2) return null;

      return {
        type: "loss",
        description: "Lost during negotiation or high-value sticker shock",
        confidence: Math.min(0.8, pricingLost.length / lost.length),
        occurrences: pricingLost.length,
        examples: pricingLost.slice(0, 3).map((p) => p.id),
        signals: ["negotiation_stalled", "competitor_undercut", "budget_constraints"],
      };
    },
  },
  {
    name: "slow_response",
    detect: (pipelines) => {
      const lost = pipelines.filter((p) => p.status === "closed_lost");
      const slowLost = lost.filter((p) => {
        const created = new Date(p.created_at);
        const closed = p.closed_at ? new Date(p.closed_at) : new Date();
        const daysDiff = (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff >= 30 && p.stage === "qualified"; // stuck in qualified for 30+ days
      });

      if (slowLost.length < 2) return null;

      return {
        type: "loss",
        description: "Leads stuck in qualified stage for 30+ days before being lost",
        confidence: Math.min(0.75, slowLost.length / lost.length),
        occurrences: slowLost.length,
        examples: slowLost.slice(0, 3).map((p) => p.id),
        signals: ["delayed_follow_up", "low_engagement", "cold_lead"],
      };
    },
  },
  {
    name: "competitor_win",
    detect: (pipelines) => {
      const lost = pipelines.filter((p) => p.status === "closed_lost");
      // Heuristic: lost in proposal stage (competitor had better offer)
      const competitorLost = lost.filter((p) => p.stage === "proposal");

      if (competitorLost.length < 2) return null;

      return {
        type: "loss",
        description: "Lost at proposal stage (likely competitor advantage)",
        confidence: Math.min(0.7, competitorLost.length / lost.length),
        occurrences: competitorLost.length,
        examples: competitorLost.slice(0, 3).map((p) => p.id),
        signals: ["competitor_mentioned", "feature_gap", "faster_delivery_promised"],
      };
    },
  },
];

const NEUTRAL_DETECTORS: PatternDetector[] = [
  {
    name: "typical_cycle",
    detect: (pipelines) => {
      const closed = pipelines.filter((p) => p.status === "closed_won" || p.status === "closed_lost");
      const avgDays =
        closed.reduce((sum, p) => {
          const created = new Date(p.created_at);
          const closedDate = p.closed_at ? new Date(p.closed_at) : new Date();
          return sum + (closedDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / (closed.length || 1);

      if (closed.length < 5) return null;

      return {
        type: "neutral",
        description: `Average sales cycle duration: ${Math.round(avgDays)} days`,
        confidence: 0.9,
        occurrences: closed.length,
        examples: closed.slice(0, 3).map((p) => p.id),
        signals: ["typical_timeline", "standard_process"],
      };
    },
  },
  {
    name: "stage_distribution",
    detect: (pipelines) => {
      const stages = pipelines.reduce((acc, p) => {
        acc[p.stage || "unknown"] = (acc[p.stage || "unknown"] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const entries = Object.entries(stages).sort((a, b) => b[1] - a[1]);
      const mostCommonStage = entries[0];
      if (!mostCommonStage || mostCommonStage[1] < 3) return null;

      return {
        type: "neutral",
        description: `Most common stage: ${mostCommonStage[0]} (${mostCommonStage[1]} pipelines)`,
        confidence: 0.8,
        occurrences: mostCommonStage[1],
        examples: pipelines.filter((p) => p.stage === mostCommonStage[0]).slice(0, 3).map((p) => p.id),
        signals: ["stage_concentration", "funnel_snapshot"],
      };
    },
  },
];

// ─── Main Extraction Function ────────────────────────────────────────────────

export function extractPatterns(pipelines: Pipeline[]): PatternExtractionResult {
  const winPatterns = WIN_DETECTORS.map((d) => d.detect(pipelines)).filter(Boolean) as Pattern[];
  const lossPatterns = LOSS_DETECTORS.map((d) => d.detect(pipelines)).filter(Boolean) as Pattern[];
  const neutralPatterns = NEUTRAL_DETECTORS.map((d) => d.detect(pipelines)).filter(Boolean) as Pattern[];

  return {
    winPatterns,
    lossPatterns,
    neutralPatterns,
    totalAnalyzed: pipelines.length,
    extractedAt: new Date().toISOString(),
  };
}

// ─── Helper: Filter Patterns by Confidence ───────────────────────────────────

export function filterByConfidence(patterns: Pattern[], minConfidence: number): Pattern[] {
  return patterns.filter((p) => p.confidence >= minConfidence);
}

// ─── Helper: Serialize Patterns for Logs ─────────────────────────────────────

export function serializePatterns(result: PatternExtractionResult): string {
  let output = `Pattern Extraction (${result.totalAnalyzed} pipelines, ${result.extractedAt})\n\n`;

  output += `Win Patterns (${result.winPatterns.length}):\n`;
  result.winPatterns.forEach((p, i) => {
    output += `  ${i + 1}. ${p.description} (conf=${p.confidence.toFixed(2)}, n=${p.occurrences})\n`;
    output += `     Signals: ${p.signals.join(", ")}\n`;
  });

  output += `\nLoss Patterns (${result.lossPatterns.length}):\n`;
  result.lossPatterns.forEach((p, i) => {
    output += `  ${i + 1}. ${p.description} (conf=${p.confidence.toFixed(2)}, n=${p.occurrences})\n`;
    output += `     Signals: ${p.signals.join(", ")}\n`;
  });

  output += `\nNeutral Patterns (${result.neutralPatterns.length}):\n`;
  result.neutralPatterns.forEach((p, i) => {
    output += `  ${i + 1}. ${p.description} (conf=${p.confidence.toFixed(2)}, n=${p.occurrences})\n`;
  });

  return output;
}
