/**
 * lib/vanguard/planning/risk_manager.ts
 * ======================================
 * Risk Manager — تقييم المخاطر في الخطط التنفيذية.
 *
 * يحلل كل PlanStep ويحدد:
 *   - احتمال الفشل
 *   - شدة التأثير
 *   - مستوى المخاطر الإجمالي
 *   - التوصيات للتخفيف
 *
 * يُستخدم في Planning Engine لاتخاذ قرار: هل الخطة آمنة؟
 */

import {
  type PlanStep,
  type ExecutionPlan,
  type Goal,
  RiskSeverity,
  GoalPriority,
} from "@/lib/vanguard/types";
import { logger } from "@/lib/vanguard/observability/logger";

// ════════════════════════════════════════════════════════════
// RISK TYPES
// ════════════════════════════════════════════════════════════

export interface RiskAssessment {
  readonly stepId:              string;
  readonly stepDescription:     string;
  readonly failureProbability:  number;  // 0.0–1.0
  readonly impactSeverity:      RiskSeverity;
  readonly riskLevel:           RiskSeverity;
  readonly mitigationStrategies: string[];
  readonly requiresApproval:    boolean;
}

export interface PlanRiskReport {
  readonly planId:          string;
  readonly overallRisk:     RiskSeverity;
  readonly stepRisks:       RiskAssessment[];
  readonly criticalSteps:   string[];  // step IDs with CRITICAL risk
  readonly mitigationPlan:  string[];
  readonly safeToExecute:   boolean;
}

// ════════════════════════════════════════════════════════════
// RISK FACTORS
// Each tool/action has a known risk profile.
// ════════════════════════════════════════════════════════════

interface RiskProfile {
  readonly failureProbability: number;
  readonly impactSeverity:     RiskSeverity;
  readonly mitigations:        string[];
}

const TOOL_RISK_PROFILES: Record<string, RiskProfile> = {
  // High-risk tools (external APIs, payments, data deletion)
  send_quote: {
    failureProbability: 0.15,
    impactSeverity:     RiskSeverity.HIGH,
    mitigations:        ["تحقق من صحة البريد/الهاتف", "Retry مع Exponential Backoff", "Fallback لـ manual send"],
  },
  generate_quote_pdf: {
    failureProbability: 0.10,
    impactSeverity:     RiskSeverity.MEDIUM,
    mitigations:        ["Fallback chain: CraftMyPDF → Cloudmersive → Restpack", "Cache template"],
  },
  update_pipeline_stage: {
    failureProbability: 0.05,
    impactSeverity:     RiskSeverity.HIGH,
    mitigations:        ["Transaction مع Rollback", "Audit log"],
  },
  persist_lead: {
    failureProbability: 0.05,
    impactSeverity:     RiskSeverity.CRITICAL,
    mitigations:        ["Idempotency key", "Retry مع check للـ duplicate"],
  },
  scrape_competitor_prices: {
    failureProbability: 0.30,
    impactSeverity:     RiskSeverity.LOW,
    mitigations:        ["Rate limiter", "Graceful degradation", "Cache last known data"],
  },
  verify_tier2: {
    failureProbability: 0.20,
    impactSeverity:     RiskSeverity.LOW,
    mitigations:        ["Rate limiter SerpStack", "Fallback to T1/T3"],
  },

  // Low-risk tools (read-only, internal)
  extract_session_insights: {
    failureProbability: 0.02,
    impactSeverity:     RiskSeverity.LOW,
    mitigations:        ["Input validation"],
  },
  analyze_intent: {
    failureProbability: 0.03,
    impactSeverity:     RiskSeverity.LOW,
    mitigations:        ["Fallback to generic intent"],
  },
  calculate_lead_score: {
    failureProbability: 0.01,
    impactSeverity:     RiskSeverity.LOW,
    mitigations:        [],
  },
  verify_tier1: {
    failureProbability: 0.01,
    impactSeverity:     RiskSeverity.LOW,
    mitigations:        [],
  },
  verify_tier3: {
    failureProbability: 0.02,
    impactSeverity:     RiskSeverity.LOW,
    mitigations:        [],
  },

  // Default profile for unknown tools
  default: {
    failureProbability: 0.10,
    impactSeverity:     RiskSeverity.MEDIUM,
    mitigations:        ["Circuit breaker", "Timeout 30s", "Graceful degradation"],
  },
};

// ════════════════════════════════════════════════════════════
// RISK CALCULATION
// ════════════════════════════════════════════════════════════

function getToolProfile(toolName: string | null): RiskProfile {
  if (!toolName) return TOOL_RISK_PROFILES.default;
  return TOOL_RISK_PROFILES[toolName] ?? TOOL_RISK_PROFILES.default;
}

function calculateRiskLevel(probability: number, impact: RiskSeverity): RiskSeverity {
  // Risk matrix: probability × impact → overall risk
  const impactScore = {
    [RiskSeverity.LOW]:      1,
    [RiskSeverity.MEDIUM]:   2,
    [RiskSeverity.HIGH]:     3,
    [RiskSeverity.CRITICAL]: 4,
  }[impact];

  const score = probability * impactScore;

  if (score >= 3.0) return RiskSeverity.CRITICAL;
  if (score >= 2.0) return RiskSeverity.HIGH;
  if (score >= 1.0) return RiskSeverity.MEDIUM;
  return RiskSeverity.LOW;
}

function assessStep(step: PlanStep): RiskAssessment {
  const profile = getToolProfile(step.toolName);
  const riskLevel = calculateRiskLevel(profile.failureProbability, profile.impactSeverity);

  // Additional risk: long-running steps are riskier (timeout risk)
  let adjustedProb = profile.failureProbability;
  if (step.estimatedDurationMs > 5000) {
    adjustedProb = Math.min(1.0, adjustedProb + 0.05);
  }

  // Additional risk: no rollback = riskier
  const hasRollback = Boolean(step.rollbackDescription);
  if (!hasRollback && profile.impactSeverity !== RiskSeverity.LOW) {
    adjustedProb = Math.min(1.0, adjustedProb + 0.03);
  }

  const finalRisk = calculateRiskLevel(adjustedProb, profile.impactSeverity);

  return {
    stepId:              step.id,
    stepDescription:     step.description,
    failureProbability:  adjustedProb,
    impactSeverity:      profile.impactSeverity,
    riskLevel:           finalRisk,
    mitigationStrategies: profile.mitigations,
    requiresApproval:    finalRisk === RiskSeverity.CRITICAL || finalRisk === RiskSeverity.HIGH,
  };
}

// ════════════════════════════════════════════════════════════
// PLAN-LEVEL RISK AGGREGATION
// ════════════════════════════════════════════════════════════

function aggregateRisk(stepRisks: RiskAssessment[]): RiskSeverity {
  const hasCritical = stepRisks.some((r) => r.riskLevel === RiskSeverity.CRITICAL);
  if (hasCritical) return RiskSeverity.CRITICAL;

  const highCount = stepRisks.filter((r) => r.riskLevel === RiskSeverity.HIGH).length;
  if (highCount >= 2) return RiskSeverity.HIGH;
  if (highCount === 1) return RiskSeverity.MEDIUM;

  const mediumCount = stepRisks.filter((r) => r.riskLevel === RiskSeverity.MEDIUM).length;
  if (mediumCount >= 3) return RiskSeverity.MEDIUM;

  return RiskSeverity.LOW;
}

function buildMitigationPlan(stepRisks: RiskAssessment[]): string[] {
  const plan: string[] = [];
  const highRiskSteps = stepRisks.filter(
    (r) => r.riskLevel === RiskSeverity.CRITICAL || r.riskLevel === RiskSeverity.HIGH
  );

  for (const risk of highRiskSteps) {
    plan.push(`🔴 خطوة "${risk.stepDescription}": ${risk.mitigationStrategies.join(", ")}`);
  }

  if (highRiskSteps.length > 0) {
    plan.push("⚠️  تفعيل Circuit Breaker على جميع الخطوات عالية المخاطر");
    plan.push("📊 تسجيل تفصيلي في Audit Log");
  }

  return plan;
}

// ════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════

export function assessPlanRisk(plan: ExecutionPlan): PlanRiskReport {
  logger.debug("[RiskManager] Assessing plan", {
    planId:    plan.id,
    stepCount: plan.steps.length,
  });

  const stepRisks = plan.steps.map(assessStep);
  const overallRisk = aggregateRisk(stepRisks);
  const criticalSteps = stepRisks
    .filter((r) => r.riskLevel === RiskSeverity.CRITICAL)
    .map((r) => r.stepId);
  const mitigationPlan = buildMitigationPlan(stepRisks);

  // Safe to execute if no CRITICAL risks
  const safeToExecute = overallRisk !== RiskSeverity.CRITICAL;

  const report: PlanRiskReport = {
    planId:        plan.id,
    overallRisk,
    stepRisks,
    criticalSteps,
    mitigationPlan,
    safeToExecute,
  };

  logger.info("[RiskManager] Assessment complete", {
    planId:        plan.id,
    overallRisk,
    criticalCount: criticalSteps.length,
    safeToExecute,
  });

  return report;
}

/**
 * Quick risk check for a single step (without full plan context).
 */
export function assessStepRisk(step: PlanStep): RiskAssessment {
  return assessStep(step);
}

/**
 * Serialize risk report to Arabic text (for Admin Panel).
 */
export function serializeRiskReport(report: PlanRiskReport): string {
  const lines: string[] = [
    `🛡️  تقرير المخاطر — الخطة: ${report.planId.slice(0, 8)}`,
    `📊 المخاطر الإجمالية: ${report.overallRisk.toUpperCase()}`,
    `✅ آمن للتنفيذ: ${report.safeToExecute ? "نعم" : "⚠️  لا — يحتاج موافقة"}`,
    "",
  ];

  if (report.criticalSteps.length > 0) {
    lines.push(`🔴 خطوات حرجة: ${report.criticalSteps.length}`);
    for (const stepId of report.criticalSteps) {
      const risk = report.stepRisks.find((r) => r.stepId === stepId);
      if (risk) {
        lines.push(`   • ${risk.stepDescription} (احتمال فشل: ${(risk.failureProbability * 100).toFixed(0)}%)`);
      }
    }
    lines.push("");
  }

  lines.push("🔧 خطة التخفيف:");
  if (report.mitigationPlan.length === 0) {
    lines.push("   لا توجد تخفيفات مطلوبة — مخاطر منخفضة");
  } else {
    for (const mitigation of report.mitigationPlan) {
      lines.push(`   ${mitigation}`);
    }
  }

  return lines.join("\n");
}
