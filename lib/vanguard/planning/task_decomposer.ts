/**
 * lib/vanguard/planning/task_decomposer.ts
 * =========================================
 * Task Decomposer — تفكيك الأهداف الكبيرة إلى مهام قابلة للتنفيذ.
 *
 * يستخدم HTN (Hierarchical Task Network) decomposition:
 *   Complex Goal → Subtasks → Atomic Actions
 *
 * كل subtask قابل للقياس، له تقدير زمني، ومعيار نجاح واضح.
 */

import {
  type Goal,
  type PlanStep,
  GoalPriority,
  RiskSeverity,
} from "@/lib/vanguard/types";
import { logger } from "@/lib/vanguard/observability/logger";

// ════════════════════════════════════════════════════════════
// DECOMPOSITION TYPES
// ════════════════════════════════════════════════════════════

export interface DecompositionResult {
  readonly originalGoal:   Goal;
  readonly subtasks:       PlanStep[];
  readonly estimatedTotal: number;  // total ms
  readonly complexity:     "simple" | "moderate" | "complex";
  readonly parallelizable: boolean;
}

interface TaskPattern {
  readonly keywords:   string[];
  readonly complexity: DecompositionResult["complexity"];
  readonly subtasks:   Array<{
    description:         string;
    toolName:            string | null;
    estimatedDurationMs: number;
    dependencies:        number[];  // indices of prerequisite subtasks
    rollbackDescription: string | null;
  }>;
}

// ════════════════════════════════════════════════════════════
// HTN TASK PATTERNS
// Each pattern describes how to decompose a specific goal type.
// ════════════════════════════════════════════════════════════

const TASK_PATTERNS: TaskPattern[] = [
  {
    keywords: ["تأهيل", "عميل", "lead"],
    complexity: "moderate",
    subtasks: [
      {
        description:         "استخراج بيانات العميل من المحادثة",
        toolName:            "extract_session_insights",
        estimatedDurationMs: 300,
        dependencies:        [],
        rollbackDescription: null,
      },
      {
        description:         "تحليل النية والاحتياج",
        toolName:            "analyze_intent",
        estimatedDurationMs: 500,
        dependencies:        [0],
        rollbackDescription: null,
      },
      {
        description:         "حساب Lead Score",
        toolName:            "calculate_lead_score",
        estimatedDurationMs: 200,
        dependencies:        [0, 1],
        rollbackDescription: null,
      },
      {
        description:         "تحديد Tier (Diamond/Gold/Silver/Bronze)",
        toolName:            "assign_lead_tier",
        estimatedDurationMs: 150,
        dependencies:        [2],
        rollbackDescription: null,
      },
      {
        description:         "تحديث Pipeline Stage",
        toolName:            "update_pipeline_stage",
        estimatedDurationMs: 200,
        dependencies:        [2, 3],
        rollbackDescription: "إرجاع Stage للسابق",
      },
      {
        description:         "حفظ Lead في vanguard_leads",
        toolName:            "persist_lead",
        estimatedDurationMs: 300,
        dependencies:        [4],
        rollbackDescription: "حذف Lead من DB",
      },
      {
        description:         "اقتراح الخطوة التالية للمبيعات",
        toolName:            "suggest_next_action",
        estimatedDurationMs: 400,
        dependencies:        [5],
        rollbackDescription: null,
      },
    ],
  },
  {
    keywords: ["إغلاق", "صفقة", "deal", "contract"],
    complexity: "complex",
    subtasks: [
      {
        description:         "التحقق من اكتمال بيانات العميل",
        toolName:            "validate_lead_data",
        estimatedDurationMs: 200,
        dependencies:        [],
        rollbackDescription: null,
      },
      {
        description:         "بناء عرض السعر (Quote)",
        toolName:            "build_quote",
        estimatedDurationMs: 1500,
        dependencies:        [0],
        rollbackDescription: "حذف Quote المسودة",
      },
      {
        description:         "توليد PDF عرض السعر",
        toolName:            "generate_quote_pdf",
        estimatedDurationMs: 3000,
        dependencies:        [1],
        rollbackDescription: "حذف PDF",
      },
      {
        description:         "إرسال عرض السعر للعميل (Email/WhatsApp)",
        toolName:            "send_quote",
        estimatedDurationMs: 1000,
        dependencies:        [2],
        rollbackDescription: null,
      },
      {
        description:         "تحديث Stage → quoted",
        toolName:            "update_pipeline_stage",
        estimatedDurationMs: 200,
        dependencies:        [3],
        rollbackDescription: "إرجاع Stage",
      },
      {
        description:         "جدولة Follow-up بعد 48 ساعة",
        toolName:            "schedule_followup",
        estimatedDurationMs: 300,
        dependencies:        [4],
        rollbackDescription: "إلغاء Follow-up",
      },
    ],
  },
  {
    keywords: ["تحليل", "سوق", "market", "competitor"],
    complexity: "moderate",
    subtasks: [
      {
        description:         "استرجاع آخر تحليل للسوق من الذاكرة",
        toolName:            "recall_market_analysis",
        estimatedDurationMs: 400,
        dependencies:        [],
        rollbackDescription: null,
      },
      {
        description:         "فحص أسعار المنافسين (SerpStack)",
        toolName:            "scrape_competitor_prices",
        estimatedDurationMs: 5000,
        dependencies:        [],
        rollbackDescription: null,
      },
      {
        description:         "تحليل الفجوات والفرص",
        toolName:            "analyze_market_gaps",
        estimatedDurationMs: 2000,
        dependencies:        [0, 1],
        rollbackDescription: null,
      },
      {
        description:         "تحديد المخاطر المحتملة",
        toolName:            "identify_market_risks",
        estimatedDurationMs: 1500,
        dependencies:        [2],
        rollbackDescription: null,
      },
      {
        description:         "حفظ Market Signals في vanguard_background_tasks",
        toolName:            "persist_market_signals",
        estimatedDurationMs: 300,
        dependencies:        [3],
        rollbackDescription: "حذف Signals",
      },
    ],
  },
  {
    keywords: ["تحقق", "verify", "citation", "معلومة"],
    complexity: "simple",
    subtasks: [
      {
        description:         "البحث في T1 (Knowledge Graph)",
        toolName:            "verify_tier1",
        estimatedDurationMs: 100,
        dependencies:        [],
        rollbackDescription: null,
      },
      {
        description:         "البحث في T3 (Admin Learnings)",
        toolName:            "verify_tier3",
        estimatedDurationMs: 200,
        dependencies:        [],
        rollbackDescription: null,
      },
      {
        description:         "البحث في T2 (Web) إن لزم",
        toolName:            "verify_tier2",
        estimatedDurationMs: 3000,
        dependencies:        [0, 1],
        rollbackDescription: null,
      },
      {
        description:         "بناء Citation Badge",
        toolName:            "build_citation",
        estimatedDurationMs: 100,
        dependencies:        [0, 1, 2],
        rollbackDescription: null,
      },
    ],
  },
];

// ════════════════════════════════════════════════════════════
// DECOMPOSITION ENGINE
// ════════════════════════════════════════════════════════════

function findPattern(goal: Goal): TaskPattern | null {
  const text = (goal.description + " " + JSON.stringify(goal.metadata)).toLowerCase();
  for (const pattern of TASK_PATTERNS) {
    if (pattern.keywords.some((kw) => text.includes(kw))) {
      return pattern;
    }
  }
  return null;
}

function buildGenericDecomposition(goal: Goal): PlanStep[] {
  // Fallback: single-step plan
  return [
    {
      id:                  crypto.randomUUID(),
      description:         goal.description,
      toolName:            null,
      toolArgs:            { goalId: goal.id },
      estimatedDurationMs: 1000,
      dependencies:        [],
      rollbackDescription: null,
    },
  ];
}

function buildStepsFromPattern(goal: Goal, pattern: TaskPattern): PlanStep[] {
  const steps: PlanStep[] = [];
  const idMap: Record<number, string> = {};

  for (let i = 0; i < pattern.subtasks.length; i++) {
    const sub = pattern.subtasks[i];
    const id  = crypto.randomUUID();
    idMap[i]  = id;

    const deps = sub.dependencies.map((depIdx) => idMap[depIdx]).filter(Boolean);

    steps.push({
      id,
      description:         sub.description,
      toolName:            sub.toolName,
      toolArgs:            { goalId: goal.id, stepIndex: i },
      estimatedDurationMs: sub.estimatedDurationMs,
      dependencies:        deps,
      rollbackDescription: sub.rollbackDescription,
    });
  }

  return steps;
}

// ════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════

export function decomposeGoal(goal: Goal): DecompositionResult {
  logger.debug("[TaskDecomposer] Decomposing goal", {
    goalId:      goal.id,
    description: goal.description.slice(0, 60),
  });

  const pattern = findPattern(goal);
  const steps   = pattern
    ? buildStepsFromPattern(goal, pattern)
    : buildGenericDecomposition(goal);

  const totalMs = steps.reduce((acc, s) => acc + s.estimatedDurationMs, 0);

  // Check if parallelizable (no dependencies = fully parallel)
  const parallelizable = steps.every((s) => s.dependencies.length === 0);

  const result: DecompositionResult = {
    originalGoal:   goal,
    subtasks:       steps,
    estimatedTotal: totalMs,
    complexity:     pattern?.complexity ?? "simple",
    parallelizable,
  };

  logger.info("[TaskDecomposer] Decomposition complete", {
    goalId:      goal.id,
    subtasks:    steps.length,
    complexity:  result.complexity,
    totalMs,
    parallelizable,
  });

  return result;
}

/**
 * Build a dependency DAG visualization (for Admin Panel).
 */
export function visualizeDAG(result: DecompositionResult): string {
  const lines: string[] = [
    `📋 تفكيك الهدف: ${result.originalGoal.description}`,
    `📊 التعقيد: ${result.complexity} | المهام: ${result.subtasks.length} | الوقت المقدر: ${(result.estimatedTotal / 1000).toFixed(1)}s`,
    "",
  ];

  for (let i = 0; i < result.subtasks.length; i++) {
    const step = result.subtasks[i];
    const deps = step.dependencies.length > 0
      ? ` ⬅️ يعتمد على: [${step.dependencies.map((d) => result.subtasks.findIndex((s) => s.id === d) + 1).join(", ")}]`
      : "";
    lines.push(`${i + 1}. ${step.description} (${step.estimatedDurationMs}ms)${deps}`);
    if (step.rollbackDescription) {
      lines.push(`   🔄 Rollback: ${step.rollbackDescription}`);
    }
  }

  return lines.join("\n");
}

/**
 * Topological sort of steps (ensures dependencies execute first).
 */
export function topologicalSort(steps: PlanStep[]): PlanStep[] {
  const sorted: PlanStep[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  const idToStep = new Map<string, PlanStep>();
  for (const step of steps) idToStep.set(step.id, step);

  function visit(stepId: string): void {
    if (visited.has(stepId)) return;
    if (temp.has(stepId)) {
      throw new Error(`Circular dependency detected involving step ${stepId}`);
    }

    temp.add(stepId);
    const step = idToStep.get(stepId);
    if (step) {
      for (const depId of step.dependencies) {
        visit(depId);
      }
      temp.delete(stepId);
      visited.add(stepId);
      sorted.push(step);
    }
  }

  for (const step of steps) {
    if (!visited.has(step.id)) visit(step.id);
  }

  return sorted;
}
