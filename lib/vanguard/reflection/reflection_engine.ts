/**
 * lib/vanguard/reflection/reflection_engine.ts
 * =============================================
 * Reflection Engine — Upgraded for Phase 1.
 *
 * Analyses recent decisions, extracts patterns from wins/losses,
 * forms new beliefs, and synthesises actionable strategies.
 * ConsciousnessCore calls reflect() every 10 cycles (lazy import).
 * 
 * Phase 1 Upgrade:
 * - Integrates pattern_extractor.ts for pipeline analysis
 * - Integrates strategy_synthesizer.ts for actionable strategies
 */

import {
  type Goal,
  type Belief,
  makeBelief,
  type Result,
  type VanguardError,
  makeError,
  Ok,
  Err,
} from "@/lib/vanguard/types";
import {
  type ReflectionOutput,
  type DecisionRecord,
} from "@/lib/vanguard/consciousness/consciousness_core";
import { logger } from "@/lib/vanguard/observability/logger";
import {
  extractPatterns as extractPipelinePatterns,
  serializePatterns,
  type PatternExtractionResult,
} from "./pattern_extractor";
import {
  synthesizeStrategies as synthesizePipelineStrategies,
  serializeStrategies,
  type StrategySynthesisResult,
} from "./strategy_synthesizer";
import type { Pipeline } from "@/lib/vanguard/types";

// ════════════════════════════════════════════════════════════
// REFLECTION INPUT
// ════════════════════════════════════════════════════════════

export interface ReflectionInput {
  readonly recentDecisions: DecisionRecord[];
  readonly currentGoals:    Goal[];
  readonly beliefs:         Belief[];
  readonly context:         Record<string, unknown>;
  readonly pipelines?:      Pipeline[]; // Phase 1: optional pipeline data for pattern extraction
}

// ════════════════════════════════════════════════════════════
// PATTERN EXTRACTION
// ════════════════════════════════════════════════════════════

interface DecisionPattern {
  readonly pattern:     string;
  readonly frequency:   number;
  readonly successRate: number;
  readonly domain:      Belief["domain"];
}

function extractPatterns(decisions: DecisionRecord[]): DecisionPattern[] {
  const outcomeMap: Record<string, { success: number; failure: number }> = {};

  for (const d of decisions) {
    const key = d.type;
    if (!outcomeMap[key]) outcomeMap[key] = { success: 0, failure: 0 };
    if (d.outcome === "success") outcomeMap[key].success++;
    else if (d.outcome === "failure") outcomeMap[key].failure++;
  }

  const patterns: DecisionPattern[] = [];
  for (const [type, counts] of Object.entries(outcomeMap)) {
    const total = counts.success + counts.failure;
    if (total < 3) continue; // not enough data
    const successRate = counts.success / total;
    patterns.push({
      pattern:     type,
      frequency:   total,
      successRate,
      domain:
        type === "action" ? "sales" :
        type === "error"  ? "technical" :
        "general",
    });
  }

  return patterns.sort((a, b) => b.frequency - a.frequency);
}

// ════════════════════════════════════════════════════════════
// BELIEF FORMATION
// ════════════════════════════════════════════════════════════

function formBeliefs(patterns: DecisionPattern[]): Belief[] {
  const beliefs: Belief[] = [];

  for (const p of patterns) {
    if (p.successRate > 0.8 && p.frequency >= 5) {
      beliefs.push(
        makeBelief({
          proposition: `نمط "${p.pattern}" يُنجح في ${(p.successRate * 100).toFixed(0)}% من الحالات (${p.frequency} مرة)`,
          confidence:  Math.min(0.95, p.successRate),
          source:      "reflection",
          domain:      p.domain,
        })
      );
    } else if (p.successRate < 0.3 && p.frequency >= 3) {
      beliefs.push(
        makeBelief({
          proposition: `نمط "${p.pattern}" يفشل في ${((1 - p.successRate) * 100).toFixed(0)}% من الحالات — يحتاج مراجعة`,
          confidence:  Math.min(0.9, 1 - p.successRate),
          source:      "reflection",
          domain:      p.domain,
        })
      );
    }
  }

  return beliefs;
}

// ════════════════════════════════════════════════════════════
// GOAL ADJUSTMENTS
// ════════════════════════════════════════════════════════════

function suggestGoalAdjustments(
  goals:    Goal[],
  patterns: DecisionPattern[]
): Array<{ goalId: string; changes: Partial<Goal> }> {
  const adjustments: Array<{ goalId: string; changes: Partial<Goal> }> = [];

  const failPattern = patterns.find((p) => p.successRate < 0.4 && p.frequency >= 3);

  for (const goal of goals) {
    if (failPattern && goal.description.toLowerCase().includes(failPattern.pattern.toLowerCase())) {
      adjustments.push({
        goalId:  goal.id,
        changes: {
          metadata: {
            ...goal.metadata,
            reflectionNote: `معدل نجاح منخفض (${(failPattern.successRate * 100).toFixed(0)}%) — مراجعة مطلوبة`,
          },
        },
      });
    }
  }

  return adjustments;
}

// ════════════════════════════════════════════════════════════
// STRATEGY SYNTHESIS
// ════════════════════════════════════════════════════════════

function synthesiseStrategies(
  patterns:  DecisionPattern[],
  decisions: DecisionRecord[]
): ReflectionOutput["newStrategies"] {
  const strategies: ReflectionOutput["newStrategies"] = [];

  const topPattern = patterns[0];
  if (!topPattern || topPattern.successRate < 0.6) return strategies;

  strategies.push({
    name:                `استراتيجية ${topPattern.pattern}`,
    description:         `مبنية على ${topPattern.frequency} قرار بمعدل نجاح ${(topPattern.successRate * 100).toFixed(0)}%`,
    steps:               [
      `رصد مؤشرات نجاح نمط "${topPattern.pattern}"`,
      "تطبيق النمط على الحالات المشابهة",
      "قياس النتائج وتحديث المعتقدات",
    ],
    estimatedSuccessRate: topPattern.successRate,
  });

  return strategies;
}

// ════════════════════════════════════════════════════════════
// PHASE 1: PIPELINE-BASED PATTERN & STRATEGY SYNTHESIS
// ════════════════════════════════════════════════════════════

async function synthesisePipelineStrategies(
  pipelines: Pipeline[]
): Promise<{
  patternResult: PatternExtractionResult;
  strategyResult: StrategySynthesisResult;
  newBeliefs: Belief[];
}> {
  // Extract patterns from pipeline data
  const patternResult = extractPipelinePatterns(pipelines);
  logger.info("[ReflectionEngine] Pipeline patterns extracted", {
    winPatterns: patternResult.winPatterns.length,
    lossPatterns: patternResult.lossPatterns.length,
    neutralPatterns: patternResult.neutralPatterns.length,
  });

  // Synthesize strategies from patterns
  const strategyResult = synthesizePipelineStrategies(patternResult);
  logger.info("[ReflectionEngine] Strategies synthesized", {
    strategies: strategyResult.strategies.length,
    critical: strategyResult.priorityQueue.filter((s) => s.priority === "critical").length,
    high: strategyResult.priorityQueue.filter((s) => s.priority === "high").length,
  });

  // Convert top patterns into beliefs
  const newBeliefs: Belief[] = [];

  // Win patterns → positive beliefs
  patternResult.winPatterns.forEach((p) => {
    newBeliefs.push(
      makeBelief({
        proposition: `نمط النجاح: ${p.description} (${p.occurrences} حالة)`,
        confidence: p.confidence,
        source: "reflection:pipeline",
        domain: "sales",
      })
    );
  });

  // Loss patterns → negative beliefs (what to avoid)
  patternResult.lossPatterns.forEach((p) => {
    newBeliefs.push(
      makeBelief({
        proposition: `نمط الخسارة: ${p.description} — يجب التخفيف (${p.occurrences} حالة)`,
        confidence: p.confidence,
        source: "reflection:pipeline",
        domain: "sales",
      })
    );
  });

  return { patternResult, strategyResult, newBeliefs };
}

// ════════════════════════════════════════════════════════════
// INSIGHT GENERATION
// ════════════════════════════════════════════════════════════

function generateInsights(
  decisions:  DecisionRecord[],
  patterns:   DecisionPattern[],
  beliefs:    Belief[]
): string[] {
  const insights: string[] = [];
  const recent = decisions.slice(-20);
  const errorCount = recent.filter((d) => d.type === "error").length;

  if (errorCount > 5) {
    insights.push(`${errorCount} خطأ في آخر 20 قرار — يُنصح بمراجعة مسارات التنفيذ`);
  }

  const successes = recent.filter((d) => d.outcome === "success").length;
  if (successes / Math.max(1, recent.length) > 0.75) {
    insights.push(`أداء ممتاز: ${successes}/${recent.length} قرار ناجح في آخر دورة`);
  }

  for (const p of patterns.slice(0, 3)) {
    insights.push(
      `نمط "${p.pattern}": ${p.frequency} مرة، نجاح ${(p.successRate * 100).toFixed(0)}%`
    );
  }

  if (beliefs.length > 20) {
    insights.push(`الذاكرة المعرفية نمت إلى ${beliefs.length} معتقد — تنقية دورية مُقترحة`);
  }

  return insights;
}

// ════════════════════════════════════════════════════════════
// PUBLIC API — consumed by ConsciousnessCore (lazy import)
// ════════════════════════════════════════════════════════════

export async function reflect(input: ReflectionInput): Promise<ReflectionOutput> {
  logger.info("[ReflectionEngine] Starting reflection", {
    decisionCount: input.recentDecisions.length,
    goalCount:     input.currentGoals.length,
    beliefCount:   input.beliefs.length,
    hasPipelines:  !!input.pipelines,
  });

  // Phase 0: Decision-based patterns (legacy)
  const decisionPatterns   = extractPatterns(input.recentDecisions);
  const decisionBeliefs    = formBeliefs(decisionPatterns);
  const goalAdjustments    = suggestGoalAdjustments(input.currentGoals, decisionPatterns);
  const decisionStrategies = synthesiseStrategies(decisionPatterns, input.recentDecisions);
  const insights           = generateInsights(input.recentDecisions, decisionPatterns, input.beliefs);

  let allBeliefs = [...decisionBeliefs];
  let allStrategies = [...decisionStrategies];

  // Phase 1: Pipeline-based patterns & strategies (if pipelines provided)
  if (input.pipelines && input.pipelines.length > 0) {
    const pipelineAnalysis = await synthesisePipelineStrategies(input.pipelines);
    allBeliefs.push(...pipelineAnalysis.newBeliefs);

    // Convert strategy_synthesizer.Strategy[] to ReflectionOutput["newStrategies"]
    const pipelineStrategies = pipelineAnalysis.strategyResult.priorityQueue.map((s) => ({
      name:                s.title,
      description:         s.description,
      steps:               s.actionableSteps,
      estimatedSuccessRate: s.confidence,
    }));
    allStrategies.push(...pipelineStrategies);

    // Add pipeline insights
    insights.push(
      `تحليل Pipeline: ${pipelineAnalysis.patternResult.totalAnalyzed} صفقة، ${pipelineAnalysis.patternResult.winPatterns.length} نمط نجاح، ${pipelineAnalysis.patternResult.lossPatterns.length} نمط خسارة`
    );
    insights.push(
      `استراتيجيات جديدة: ${pipelineAnalysis.strategyResult.priorityQueue.filter((s) => s.priority === "critical").length} حرجة، ${pipelineAnalysis.strategyResult.priorityQueue.filter((s) => s.priority === "high").length} عالية`
    );

    // Log serialized patterns & strategies for debugging
    logger.debug("[ReflectionEngine] Pipeline Patterns:\n" + serializePatterns(pipelineAnalysis.patternResult));
    logger.debug("[ReflectionEngine] Synthesized Strategies:\n" + serializeStrategies(pipelineAnalysis.strategyResult));
  }

  const output: ReflectionOutput = {
    newBeliefs: allBeliefs,
    goalAdjustments,
    newStrategies: allStrategies,
    insights,
  };

  logger.info("[ReflectionEngine] Reflection complete", {
    newBeliefs:      allBeliefs.length,
    adjustments:     goalAdjustments.length,
    strategies:      allStrategies.length,
    insights:        insights.length,
  });

  return output;
}

export function analyseDecisionQuality(decisions: DecisionRecord[]): {
  successRate: number;
  errorRate:   number;
  topPatterns: string[];
} {
  const total   = decisions.length;
  if (total === 0) return { successRate: 1, errorRate: 0, topPatterns: [] };
  const success = decisions.filter((d) => d.outcome === "success").length;
  const errors  = decisions.filter((d) => d.type === "error").length;
  const patterns = extractPatterns(decisions);
  return {
    successRate: success / total,
    errorRate:   errors / total,
    topPatterns: patterns.slice(0, 3).map((p) => p.pattern),
  };
}
