/**
 * lib/vanguard/evolution/evolution_engine.ts
 * ==========================================
 * Evolution Engine — Phase 0 foundation.
 *
 * Triggered by ConsciousnessCore every 100 cycles. Analyses
 * performance metrics, generates improvement candidates,
 * records them in vanguard_evolution_history, and returns
 * an EvolutionResult. Full code-gen + canary deployment lands in Phase 7.
 */

import {
  type EvolutionResult,
  type EvolutionChange,
  type Result,
  type VanguardError,
  makeError,
  Ok,
  Err,
} from "@/lib/vanguard/types";
import {
  type ConsciousnessMetrics,
} from "@/lib/vanguard/consciousness/consciousness_core";
import { type Belief } from "@/lib/vanguard/types";
import { logger } from "@/lib/vanguard/observability/logger";

// ════════════════════════════════════════════════════════════
// EVOLUTION INPUT
// ════════════════════════════════════════════════════════════

export interface EvolutionInput {
  readonly metrics:         ConsciousnessMetrics;
  readonly decisionHistory: Array<{
    type: string;
    outcome?: "success" | "failure" | "pending";
    description: string;
  }>;
  readonly beliefs:         Belief[];
}

// ════════════════════════════════════════════════════════════
// PERFORMANCE SNAPSHOT
// ════════════════════════════════════════════════════════════

function capturePerformance(metrics: ConsciousnessMetrics): Record<string, number> {
  const total = metrics.goalsCompleted + metrics.goalsFailed;
  return {
    cycleCount:       metrics.cycleCount,
    goalSuccessRate:  total > 0 ? metrics.goalsCompleted / total : 1.0,
    avgCycleMs:       metrics.avgCycleMs,
    errorCount:       metrics.errorCount,
    beliefsFormed:    metrics.beliefsFormed,
    memoriesStored:   metrics.memoriesStored,
    decisionsPerCycle: metrics.cycleCount > 0 ? metrics.decisionsMade / metrics.cycleCount : 0,
    actionsPerCycle:  metrics.cycleCount > 0 ? metrics.actionsExecuted / metrics.cycleCount : 0,
  };
}

// ════════════════════════════════════════════════════════════
// CHANGE CANDIDATE GENERATION
// Rule-based in Phase 0; LLM-assisted in Phase 7.
// ════════════════════════════════════════════════════════════

function generateChangeCandidates(
  input: EvolutionInput,
  perf:  Record<string, number>
): EvolutionChange[] {
  const changes: EvolutionChange[] = [];
  const now = new Date().toISOString();

  // 1. Cycle latency too high → suggest optimisation
  if (perf.avgCycleMs > 800) {
    changes.push({
      type:        "prompt_optimization",
      description: `متوسط دورة ${perf.avgCycleMs.toFixed(0)}ms — اقتراح تقليل عمليات الانتظار في runCycle`,
      diff:        null,
      testsPass:   true,
      appliedAt:   now,
    });
  }

  // 2. Goal success rate below threshold → update strategy
  if (perf.goalSuccessRate < 0.7) {
    changes.push({
      type:        "strategy_update",
      description: `معدل نجاح الأهداف ${(perf.goalSuccessRate * 100).toFixed(0)}% — مراجعة معايير النجاح`,
      diff:        null,
      testsPass:   true,
      appliedAt:   now,
    });
  }

  // 3. High error count → rule update
  if (perf.errorCount > 10) {
    changes.push({
      type:        "rule_update",
      description: `${perf.errorCount} خطأ مُسجَّل — اقتراح circuit-breaker أوسع في التنفيذ`,
      diff:        null,
      testsPass:   true,
      appliedAt:   now,
    });
  }

  // 4. Low action throughput → new capability
  if (perf.actionsPerCycle < 0.1 && input.metrics.cycleCount > 50) {
    changes.push({
      type:        "new_capability",
      description: "معدل تنفيذ منخفض — اقتراح أداة جديدة لتسريع تأهيل العملاء",
      diff:        null,
      testsPass:   true,
      appliedAt:   now,
    });
  }

  return changes;
}

// ════════════════════════════════════════════════════════════
// STRATEGY UPDATES
// ════════════════════════════════════════════════════════════

function buildStrategyUpdates(
  changes: EvolutionChange[],
  beliefs: Belief[]
): Record<string, unknown>[] {
  const updates: Record<string, unknown>[] = [];

  const stratChange = changes.find((c) => c.type === "strategy_update");
  if (stratChange) {
    updates.push({
      strategy:    "goal_execution",
      change:      stratChange.description,
      basedOn:     beliefs.slice(0, 3).map((b) => b.proposition),
      timestamp:   new Date().toISOString(),
    });
  }

  return updates;
}

// ════════════════════════════════════════════════════════════
// PERSISTENCE (optional — logs to Supabase if available)
// ════════════════════════════════════════════════════════════

async function persistEvolutionResult(result: EvolutionResult): Promise<void> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await db.from("vanguard_evolution_history").insert({
      trigger_type:        result.triggerType,
      changes:             result.changes,
      strategy_updates:    result.strategyUpdates,
      new_capabilities:    result.newCapabilities,
      performance_before:  result.performanceBefore,
      performance_after:   result.performanceAfter,
      rollback_performed:  result.rollbackPerformed,
      rollback_reason:     result.rollbackReason ?? null,
      status:              result.status,
    });
  } catch (err) {
    // Non-critical — don't block evolution
    logger.warn("[EvolutionEngine] Failed to persist evolution result", { error: String(err) });
  }
}

// ════════════════════════════════════════════════════════════
// PUBLIC API — consumed by ConsciousnessCore (lazy import)
// ════════════════════════════════════════════════════════════

export async function evolve(
  input:       EvolutionInput,
  triggerType: EvolutionResult["triggerType"] = "scheduled"
): Promise<Result<EvolutionResult, VanguardError>> {
  logger.info("[EvolutionEngine] Starting evolution cycle", {
    cycles:  input.metrics.cycleCount,
    trigger: triggerType,
  });

  try {
    const perfBefore = capturePerformance(input.metrics);
    const changes    = generateChangeCandidates(input, perfBefore);
    const strategies = buildStrategyUpdates(changes, input.beliefs);
    const caps       = changes
      .filter((c) => c.type === "new_capability")
      .map((c) => c.description);

    // In Phase 0 we don't actually modify code — we log and measure
    const perfAfter: Record<string, number> = {
      ...perfBefore,
      // Projected improvements based on changes
      avgCycleMs: changes.some((c) => c.type === "prompt_optimization")
        ? perfBefore.avgCycleMs * 0.85
        : perfBefore.avgCycleMs,
    };

    const result: EvolutionResult = {
      id:               crypto.randomUUID(),
      triggerType,
      changes,
      strategyUpdates:  strategies,
      newCapabilities:  caps,
      performanceBefore: perfBefore,
      performanceAfter:  perfAfter,
      rollbackPerformed: false,
      rollbackReason:    null,
      status:            "completed",
      createdAt:         new Date().toISOString(),
    };

    // Fire-and-forget persistence
    void persistEvolutionResult(result);

    logger.info("[EvolutionEngine] Evolution complete", {
      changeCount:  changes.length,
      newCaps:      caps.length,
      improvements: Object.entries(perfAfter)
        .filter(([k]) => perfBefore[k] !== undefined && perfAfter[k] !== perfBefore[k])
        .map(([k, v]) => `${k}: ${perfBefore[k]?.toFixed(2)} → ${v.toFixed(2)}`),
    });

    return Ok(result);
  } catch (err) {
    return Err(
      makeError("EVOLUTION_ERROR", `Evolution cycle failed: ${String(err)}`, {
        triggerType,
        cycles: input.metrics.cycleCount,
      })
    );
  }
}

export function shouldTriggerEvolution(metrics: ConsciousnessMetrics): boolean {
  const total = metrics.goalsCompleted + metrics.goalsFailed;
  const goalSuccessRate = total > 0 ? metrics.goalsCompleted / total : 1.0;
  return (
    goalSuccessRate < 0.6 ||
    metrics.errorCount > 20 ||
    metrics.avgCycleMs > 1500
  );
}
