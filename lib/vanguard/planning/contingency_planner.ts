/**
 * lib/vanguard/planning/contingency_planner.ts
 * =============================================
 * Contingency Planner — خطط بديلة لمواجهة الفشل.
 *
 * يُنشئ if-then fallback plans لكل step عالية المخاطر:
 *   "إذا فشلت الخطوة X، جرب Y، وإن فشلت Y، افعل Z"
 *
 * كل contingency plan له:
 *   - شرط التفعيل (trigger condition)
 *   - خطوات بديلة مرتبة بالأولوية
 *   - معيار نجاح/فشل واضح
 */

import {
  type PlanStep,
  type ExecutionPlan,
  RiskSeverity,
} from "@/lib/vanguard/types";
import { logger } from "@/lib/vanguard/observability/logger";
import { type RiskAssessment } from "./risk_manager";

// ════════════════════════════════════════════════════════════
// CONTINGENCY TYPES
// ════════════════════════════════════════════════════════════

export interface ContingencyStep {
  readonly fallbackAction:  string;
  readonly description:     string;
  readonly estimatedMs:     number;
  readonly successProbability: number;
}

export interface ContingencyPlan {
  readonly originalStepId:      string;
  readonly originalDescription: string;
  readonly triggerCondition:    string;  // e.g. "timeout", "rate_limit", "api_error"
  readonly fallbackChain:       ContingencyStep[];
  readonly ultimateFallback:    string;  // what to do if all fallbacks fail
}

export interface ContingencyReport {
  readonly planId:          string;
  readonly contingencies:   ContingencyPlan[];
  readonly coveragePercent: number;  // % of high-risk steps with contingencies
}

// ════════════════════════════════════════════════════════════
// FALLBACK TEMPLATES
// Known fallback strategies for common tool failures.
// ════════════════════════════════════════════════════════════

interface FallbackTemplate {
  readonly toolName:        string;
  readonly triggerCondition: string;
  readonly fallbacks:       ContingencyStep[];
  readonly ultimateFallback: string;
}

const FALLBACK_TEMPLATES: FallbackTemplate[] = [
  {
    toolName:        "send_quote",
    triggerCondition: "email/whatsapp delivery failure",
    fallbacks: [
      {
        fallbackAction:      "retry_with_exponential_backoff",
        description:         "إعادة المحاولة بعد 2s، 4s، 8s",
        estimatedMs:         14000,
        successProbability:  0.70,
      },
      {
        fallbackAction:      "switch_channel",
        description:         "إذا فشل Email، جرب WhatsApp (أو العكس)",
        estimatedMs:         2000,
        successProbability:  0.80,
      },
      {
        fallbackAction:      "queue_for_manual_send",
        description:         "إضافة للـ queue ليرسله مستشار يدوياً",
        estimatedMs:         500,
        successProbability:  1.0,
      },
    ],
    ultimateFallback: "إبلاغ المستشار — الإرسال اليدوي مطلوب",
  },
  {
    toolName:        "generate_quote_pdf",
    triggerCondition: "PDF generation API timeout or failure",
    fallbacks: [
      {
        fallbackAction:      "try_next_pdf_provider",
        description:         "CraftMyPDF → Cloudmersive → Restpack → Invovate",
        estimatedMs:         3000,
        successProbability:  0.85,
      },
      {
        fallbackAction:      "use_html_fallback",
        description:         "إنشاء HTML-to-PDF محلي (Puppeteer fallback)",
        estimatedMs:         5000,
        successProbability:  0.90,
      },
    ],
    ultimateFallback: "إرسال عرض السعر كـ HTML منسق بدلاً من PDF",
  },
  {
    toolName:        "update_pipeline_stage",
    triggerCondition: "database transaction failure",
    fallbacks: [
      {
        fallbackAction:      "retry_with_rollback",
        description:         "إعادة المحاولة بعد rollback كامل",
        estimatedMs:         1000,
        successProbability:  0.80,
      },
      {
        fallbackAction:      "queue_for_retry",
        description:         "إضافة للـ background task queue",
        estimatedMs:         300,
        successProbability:  0.95,
      },
    ],
    ultimateFallback: "تسجيل في Audit Log + إشعار للأدمن",
  },
  {
    toolName:        "persist_lead",
    triggerCondition: "duplicate key or constraint violation",
    fallbacks: [
      {
        fallbackAction:      "check_existing_lead",
        description:         "التحقق إذا كان Lead موجود بالفعل",
        estimatedMs:         200,
        successProbability:  1.0,
      },
      {
        fallbackAction:      "upsert_instead",
        description:         "استخدام UPSERT بدلاً من INSERT",
        estimatedMs:         300,
        successProbability:  0.98,
      },
    ],
    ultimateFallback: "استخدام existing Lead وتحديث بياناته فقط",
  },
  {
    toolName:        "scrape_competitor_prices",
    triggerCondition: "rate limit or scraping blocked",
    fallbacks: [
      {
        fallbackAction:      "use_cached_data",
        description:         "استخدام آخر بيانات مخزنة (خلال 24h)",
        estimatedMs:         100,
        successProbability:  1.0,
      },
      {
        fallbackAction:      "skip_competitor_analysis",
        description:         "تخطي هذه الخطوة والاستمرار",
        estimatedMs:         0,
        successProbability:  1.0,
      },
    ],
    ultimateFallback: "تحليل السوق بدون بيانات المنافسين الحية",
  },
  {
    toolName:        "verify_tier2",
    triggerCondition: "web search API rate limit or failure",
    fallbacks: [
      {
        fallbackAction:      "fallback_to_tier1",
        description:         "استخدام نتائج T1 (Knowledge Graph) فقط",
        estimatedMs:         100,
        successProbability:  0.80,
      },
      {
        fallbackAction:      "fallback_to_tier3",
        description:         "استخدام T3 (Admin Learnings) إن وُجدت",
        estimatedMs:         200,
        successProbability:  0.75,
      },
    ],
    ultimateFallback: "الرد بدون تحقق Tier 2 + إضافة تحذير 'غير مُتحقَّق خارجياً'",
  },
];

// ════════════════════════════════════════════════════════════
// CONTINGENCY GENERATION
// ════════════════════════════════════════════════════════════

function findFallbackTemplate(toolName: string | null): FallbackTemplate | null {
  if (!toolName) return null;
  return FALLBACK_TEMPLATES.find((t) => t.toolName === toolName) ?? null;
}

function generateContingency(
  step:       PlanStep,
  riskAssess: RiskAssessment
): ContingencyPlan | null {
  // Only generate contingencies for HIGH/CRITICAL risk steps
  if (riskAssess.riskLevel !== RiskSeverity.HIGH && riskAssess.riskLevel !== RiskSeverity.CRITICAL) {
    return null;
  }

  const template = findFallbackTemplate(step.toolName);
  if (!template) {
    // Generic fallback
    return {
      originalStepId:      step.id,
      originalDescription: step.description,
      triggerCondition:    "أي فشل في التنفيذ",
      fallbackChain: [
        {
          fallbackAction:      "retry_once",
          description:         "إعادة المحاولة مرة واحدة",
          estimatedMs:         step.estimatedDurationMs,
          successProbability:  0.60,
        },
        {
          fallbackAction:      "skip_and_log",
          description:         "تخطي الخطوة وتسجيلها في Audit Log",
          estimatedMs:         100,
          successProbability:  1.0,
        },
      ],
      ultimateFallback: "تسجيل الفشل والاستمرار",
    };
  }

  return {
    originalStepId:      step.id,
    originalDescription: step.description,
    triggerCondition:    template.triggerCondition,
    fallbackChain:       template.fallbacks,
    ultimateFallback:    template.ultimateFallback,
  };
}

// ════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════

export function buildContingencyReport(
  plan:       ExecutionPlan,
  riskAssessments: RiskAssessment[]
): ContingencyReport {
  logger.debug("[ContingencyPlanner] Building contingencies", {
    planId:    plan.id,
    stepCount: plan.steps.length,
  });

  const contingencies: ContingencyPlan[] = [];

  for (const step of plan.steps) {
    const riskAssess = riskAssessments.find((r) => r.stepId === step.id);
    if (!riskAssess) continue;

    const cont = generateContingency(step, riskAssess);
    if (cont) contingencies.push(cont);
  }

  const highRiskCount = riskAssessments.filter(
    (r) => r.riskLevel === RiskSeverity.HIGH || r.riskLevel === RiskSeverity.CRITICAL
  ).length;
  const coveragePercent = highRiskCount > 0
    ? (contingencies.length / highRiskCount) * 100
    : 100;

  const report: ContingencyReport = {
    planId:          plan.id,
    contingencies,
    coveragePercent,
  };

  logger.info("[ContingencyPlanner] Report built", {
    planId:          plan.id,
    contingencies:   contingencies.length,
    coveragePercent: coveragePercent.toFixed(0),
  });

  return report;
}

/**
 * Serialize contingency report to Arabic text (for Admin Panel).
 */
export function serializeContingencyReport(report: ContingencyReport): string {
  const lines: string[] = [
    `🔄 خطط الطوارئ — الخطة: ${report.planId.slice(0, 8)}`,
    `📊 التغطية: ${report.coveragePercent.toFixed(0)}% من الخطوات عالية المخاطر`,
    "",
  ];

  if (report.contingencies.length === 0) {
    lines.push("✅ لا توجد خطط طوارئ مطلوبة — الخطة منخفضة المخاطر");
    return lines.join("\n");
  }

  for (let i = 0; i < report.contingencies.length; i++) {
    const cont = report.contingencies[i];
    lines.push(`${i + 1}. 🎯 ${cont.originalDescription}`);
    lines.push(`   🚨 التفعيل: ${cont.triggerCondition}`);
    lines.push(`   🔄 البدائل:`);
    for (let j = 0; j < cont.fallbackChain.length; j++) {
      const fb = cont.fallbackChain[j];
      lines.push(`      ${j + 1}. ${fb.description} (نجاح: ${(fb.successProbability * 100).toFixed(0)}%)`);
    }
    lines.push(`   ⚠️  البديل النهائي: ${cont.ultimateFallback}`);
    lines.push("");
  }

  return lines.join("\n");
}
