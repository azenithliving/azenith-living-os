/**
 * lib/vanguard/planning/planning_engine.ts
 * =========================================
 * HTN Planning Engine — FULL IMPLEMENTATION (Phase 1 Task 5).
 *
 * Capabilities:
 *   - HTN decomposition (complex goal → atomic subtasks)
 *   - Risk assessment per step + plan-level aggregation
 *   - Contingency planning (if-then fallback chains)
 *   - DAG execution order (topological sort)
 *   - Hands off to AutonomousExecutor (Phase 3)
 *
 * Integration: ConsciousnessCore calls this during PLANNING state.
 */

import {
  type Goal,
  type ExecutionPlan,
  type PlanStep,
  type Result,
  type VanguardError,
  GoalPriority,
  RiskSeverity,
  makeError,
  Ok,
  Err,
} from "@/lib/vanguard/types";
import { logger } from "@/lib/vanguard/observability/logger";
import { decomposeGoal, topologicalSort, visualizeDAG } from "./task_decomposer";
import { assessPlanRisk, serializeRiskReport } from "./risk_manager";
import { buildContingencyReport, serializeContingencyReport } from "./contingency_planner";

// ════════════════════════════════════════════════════════════
// PLAN TEMPLATES
// Static templates keyed by goal description keywords.
// The LLM-based planner (Phase 1 Task 5) will replace/extend these.
// ════════════════════════════════════════════════════════════

interface PlanTemplate {
  readonly keywords: string[];
  readonly steps: Array<{
    description: string;
    toolName: string | null;
    estimatedDurationMs: number;
  }>;
  readonly riskLevel: RiskSeverity;
}

const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    keywords: ["تأهيل", "عميل", "lead", "qualify"],
    riskLevel: RiskSeverity.LOW,
    steps: [
      { description: "جمع بيانات العميل من المحادثة",         toolName: "extract_session_insights",   estimatedDurationMs: 500  },
      { description: "تحليل النية والاحتياج",                  toolName: "analyze_intent",              estimatedDurationMs: 800  },
      { description: "حساب Lead Score",                         toolName: "score_lead",                  estimatedDurationMs: 300  },
      { description: "تحديد المرحلة في Pipeline",               toolName: "update_pipeline_stage",       estimatedDurationMs: 200  },
      { description: "اقتراح الخطوة التالية للمبيعات",          toolName: "suggest_next_action",         estimatedDurationMs: 600  },
    ],
  },
  {
    keywords: ["دقة", "تحقق", "hallucination", "verify", "citation"],
    riskLevel: RiskSeverity.LOW,
    steps: [
      { description: "فحص المعلومات عبر Tier 1 (Knowledge Graph)", toolName: "verify_tier1",           estimatedDurationMs: 200  },
      { description: "فحص Tier 3 (Admin Learnings) إن لزم",        toolName: "verify_tier3",           estimatedDurationMs: 150  },
      { description: "إضافة Citation badge للرد",                   toolName: "attach_citation",        estimatedDurationMs: 100  },
    ],
  },
  {
    keywords: ["سوق", "منافس", "market", "competitor", "watch"],
    riskLevel: RiskSeverity.LOW,
    steps: [
      { description: "فحص آخر تحديثات أسعار المنافسين",   toolName: "market_watch_scan",          estimatedDurationMs: 2000 },
      { description: "تحليل الفرص والمخاطر",               toolName: "analyze_market_signals",     estimatedDurationMs: 1000 },
      { description: "تحديث MarketSignal في الذاكرة",      toolName: "store_market_signals",       estimatedDurationMs: 300  },
    ],
  },
  {
    keywords: ["تطور", "evolve", "evolution", "improve", "تحسين"],
    riskLevel: RiskSeverity.MEDIUM,
    steps: [
      { description: "قراءة مقاييس الأداء الحالية",       toolName: "read_performance_metrics",   estimatedDurationMs: 400  },
      { description: "تحليل أنماط الفشل والنجاح",         toolName: "analyze_patterns",           estimatedDurationMs: 1500 },
      { description: "اقتراح تحسينات محددة",              toolName: "suggest_improvements",       estimatedDurationMs: 2000 },
      { description: "تسجيل اقتراحات التطور",             toolName: "log_evolution_suggestions",  estimatedDurationMs: 200  },
    ],
  },
];

// ════════════════════════════════════════════════════════════
// PLANNER
// ════════════════════════════════════════════════════════════

function findTemplate(description: string): PlanTemplate | null {
  const lower = description.toLowerCase();
  for (const template of PLAN_TEMPLATES) {
    if (template.keywords.some((kw) => lower.includes(kw))) {
      return template;
    }
  }
  return null;
}

function buildPlanFromTemplate(
  goal: Goal,
  template: PlanTemplate
): ExecutionPlan {
  const steps: PlanStep[] = template.steps.map((s, idx) => ({
    id:                    crypto.randomUUID(),
    description:           s.description,
    toolName:              s.toolName,
    toolArgs:              { goalId: goal.id, goalDescription: goal.description },
    estimatedDurationMs:   s.estimatedDurationMs,
    dependencies:          idx === 0 ? [] : [], // linear for now; DAG in Phase 3
    rollbackDescription:   null,
  }));

  const totalMs = steps.reduce((acc, s) => acc + s.estimatedDurationMs, 0);

  return {
    id:               crypto.randomUUID(),
    goalId:           goal.id,
    steps,
    estimatedTotalMs: totalMs,
    riskLevel:        template.riskLevel,
    createdAt:        new Date().toISOString(),
  };
}

function buildDefaultPlan(goal: Goal): ExecutionPlan {
  const steps: PlanStep[] = [
    {
      id:                  crypto.randomUUID(),
      description:         `تنفيذ الهدف: ${goal.description}`,
      toolName:            null,
      toolArgs:            { goalId: goal.id },
      estimatedDurationMs: 1000,
      dependencies:        [],
      rollbackDescription: null,
    },
  ];

  return {
    id:               crypto.randomUUID(),
    goalId:           goal.id,
    steps,
    estimatedTotalMs: 1000,
    riskLevel:        RiskSeverity.LOW,
    createdAt:        new Date().toISOString(),
  };
}

// ════════════════════════════════════════════════════════════
// PUBLIC API — consumed by ConsciousnessCore (lazy import)
// ════════════════════════════════════════════════════════════

export async function planAndExecuteGoal(
  goal: Goal,
  context: Record<string, unknown>
): Promise<Result<ExecutionPlan, VanguardError>> {
  logger.info("[PlanningEngine] Planning goal", {
    goalId:      goal.id,
    description: goal.description.slice(0, 60),
    priority:    goal.priority,
  });

  try {
    // Step 1: HTN Decomposition
    const decomposition = decomposeGoal(goal);
    logger.debug("[PlanningEngine] Decomposition complete", {
      goalId:     goal.id,
      subtasks:   decomposition.subtasks.length,
      complexity: decomposition.complexity,
      totalMs:    decomposition.estimatedTotal,
    });

    // Step 2: Topological sort (ensure dependencies execute first)
    const sortedSteps = topologicalSort(decomposition.subtasks);

    // Step 3: Build ExecutionPlan
    let plan: ExecutionPlan = {
      id:               crypto.randomUUID(),
      goalId:           goal.id,
      steps:            sortedSteps,
      estimatedTotalMs: decomposition.estimatedTotal,
      riskLevel:        RiskSeverity.LOW,  // will be overwritten by risk assessment
      createdAt:        new Date().toISOString(),
    };

    // Step 4: Risk Assessment
    const riskReport = assessPlanRisk(plan);
    plan = { ...plan, riskLevel: riskReport.overallRisk };

    logger.info("[PlanningEngine] Risk assessment", {
      planId:        plan.id,
      overallRisk:   riskReport.overallRisk,
      safeToExecute: riskReport.safeToExecute,
      criticalSteps: riskReport.criticalSteps.length,
    });

    // Step 5: Contingency Planning
    const contingencyReport = buildContingencyReport(plan, riskReport.stepRisks);
    logger.info("[PlanningEngine] Contingency planning", {
      planId:        plan.id,
      contingencies: contingencyReport.contingencies.length,
      coverage:      contingencyReport.coveragePercent.toFixed(0) + "%",
    });

    // Step 6: Log full plan details (observability)
    logger.debug("[PlanningEngine] DAG Visualization:\n" + visualizeDAG(decomposition));
    logger.debug("[PlanningEngine] Risk Report:\n" + serializeRiskReport(riskReport));
    logger.debug("[PlanningEngine] Contingency Report:\n" + serializeContingencyReport(contingencyReport));

    // Step 7: Block execution if CRITICAL risk without approval
    if (riskReport.overallRisk === RiskSeverity.CRITICAL && !context.adminApproval) {
      return Err(
        makeError("PLAN_CRITICAL_RISK", "Plan has CRITICAL risk — admin approval required", {
          planId:        plan.id,
          criticalSteps: riskReport.criticalSteps,
          mitigations:   riskReport.mitigationPlan,
        })
      );
    }

    logger.info("[PlanningEngine] Plan ready for execution", {
      planId:        plan.id,
      steps:         plan.steps.length,
      estimatedMs:   plan.estimatedTotalMs,
      riskLevel:     plan.riskLevel,
    });

    return Ok(plan);
  } catch (err) {
    return Err(
      makeError("PLANNING_ERROR", `Failed to plan goal: ${String(err)}`, {
        goalId:      goal.id,
        description: goal.description.slice(0, 100),
      })
    );
  }
}

export function estimateGoalComplexity(goal: Goal): {
  complexity: "simple" | "moderate" | "complex";
  estimatedMs: number;
  riskLevel: RiskSeverity;
} {
  const template = findTemplate(goal.description);
  if (!template) {
    return { complexity: "simple", estimatedMs: 1000, riskLevel: RiskSeverity.LOW };
  }
  const totalMs = template.steps.reduce((acc, s) => acc + s.estimatedDurationMs, 0);
  const complexity =
    template.steps.length <= 2 ? "simple" : template.steps.length <= 4 ? "moderate" : "complex";
  return { complexity, estimatedMs: totalMs, riskLevel: template.riskLevel };
}
