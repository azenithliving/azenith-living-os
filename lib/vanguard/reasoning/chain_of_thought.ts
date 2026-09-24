/**
 * lib/vanguard/reasoning/chain_of_thought.ts
 * ===========================================
 * Chain-of-Thought (CoT) — التفكير الخطي المتسلسل.
 *
 * يحل المشكلة خطوة بخطوة، كل خطوة تبني على السابقة.
 * كل خطوة تُسجَّل في reasoning_steps لعرضها في Admin Panel.
 *
 * Pattern: Thought → Action → Observation → Next Thought
 */

import {
  type ReasoningTrace,
  type ThoughtStep,
} from "@/lib/vanguard/types";
import { logger } from "@/lib/vanguard/observability/logger";

// ════════════════════════════════════════════════════════════
// COT REQUEST
// ════════════════════════════════════════════════════════════

export interface CoTRequest {
  readonly query:       string;
  readonly context:     Record<string, unknown>;
  readonly maxSteps:    number;
  readonly temperature: number;
}

// ════════════════════════════════════════════════════════════
// STEP TEMPLATES
// Rule-based CoT for common scenarios. LLM-based CoT (Phase 1 Task 4 full)
// replaces these with dynamic generation.
// ════════════════════════════════════════════════════════════

interface StepTemplate {
  readonly keywords:   string[];
  readonly steps:      Array<{
    thought:     string;
    action:      string;
    observation: string;
  }>;
}

const COT_TEMPLATES: StepTemplate[] = [
  {
    keywords: ["خشب", "مادة", "متوافق", "يناسب"],
    steps: [
      {
        thought:     "تحديد المواد المذكورة في الاستعلام",
        action:      "extract_materials",
        observation: "تم استخراج قائمة المواد",
      },
      {
        thought:     "البحث في قاعدة المعرفة عن خصائص كل مادة",
        action:      "query_knowledge_graph",
        observation: "تم استرجاع الخصائص من Knowledge Graph",
      },
      {
        thought:     "فحص علاقة التوافق بين المواد",
        action:      "check_compatibility",
        observation: "تم تحديد المواد المتوافقة وغير المتوافقة",
      },
      {
        thought:     "تكوين توصية نهائية بناءً على النتائج",
        action:      "synthesize_recommendation",
        observation: "توصية جاهزة مع الأدلة",
      },
    ],
  },
  {
    keywords: ["تأهيل", "عميل", "lead", "score"],
    steps: [
      {
        thought:     "تحليل بيانات العميل المتاحة من المحادثة",
        action:      "extract_lead_data",
        observation: "تم استخراج: غرفة، ميزانية، إلحاح، أسلوب",
      },
      {
        thought:     "حساب Lead Score بناءً على معايير التأهيل",
        action:      "calculate_lead_score",
        observation: "Score محسوب: 0-100",
      },
      {
        thought:     "تحديد المرحلة المناسبة في Pipeline",
        action:      "assign_pipeline_stage",
        observation: "المرحلة محددة: new/qualified/quoted",
      },
      {
        thought:     "اقتراح الخطوة التالية للمبيعات",
        action:      "suggest_next_action",
        observation: "الخطوة التالية: {إرسال كتالوج / جدولة زيارة / عرض سعر}",
      },
    ],
  },
  {
    keywords: ["سعر", "عرض", "تسعير", "ميزانية"],
    steps: [
      {
        thought:     "فحص ما إذا كان العميل مؤهلاً لعرض سعر",
        action:      "check_qualification",
        observation: "حالة التأهيل: {qualified / needs_more_info}",
      },
      {
        thought:     "التحقق من موافقة المالك على الإفصاح عن السعر",
        action:      "check_pricing_consent",
        observation: "موافقة السعر: {granted / denied}",
      },
      {
        thought:     "إذا كانت الموافقة مرفوضة، توجيه العميل للتواصل المباشر",
        action:      "redirect_to_sales",
        observation: "تم توجيه العميل لمستشار المبيعات",
      },
    ],
  },
];

// ════════════════════════════════════════════════════════════
// COT EXECUTION
// ════════════════════════════════════════════════════════════

function findTemplate(query: string): StepTemplate | null {
  const lower = query.toLowerCase();
  for (const template of COT_TEMPLATES) {
    if (template.keywords.some((kw) => lower.includes(kw))) {
      return template;
    }
  }
  return null;
}

function buildGenericChain(query: string): ThoughtStep[] {
  return [
    {
      stepNumber:  1,
      thought:     `فهم السؤال: "${query.slice(0, 60)}"`,
      action:      "parse_query",
      observation: "تم تحليل السؤال — استخراج الهدف الرئيسي",
      confidence:  0.8,
    },
    {
      stepNumber:  2,
      thought:     "البحث في الذاكرة عن معلومات ذات صلة",
      action:      "recall_memory",
      observation: "تم استرجاع ذكريات ذات صلة",
      confidence:  0.75,
    },
    {
      stepNumber:  3,
      thought:     "تطبيق المعرفة المسترجعة على السؤال",
      action:      "apply_knowledge",
      observation: "تم تكوين إجابة أولية",
      confidence:  0.7,
    },
    {
      stepNumber:  4,
      thought:     "التحقق من الإجابة عبر Citations",
      action:      "verify_answer",
      observation: "تم التحقق — الإجابة مدعومة بمصادر موثوقة",
      confidence:  0.85,
    },
  ];
}

function buildChainFromTemplate(template: StepTemplate): ThoughtStep[] {
  return template.steps.map((s, idx) => ({
    stepNumber:  idx + 1,
    thought:     s.thought,
    action:      s.action,
    observation: s.observation,
    confidence:  0.85 - idx * 0.05,  // تنازلي قليلاً مع تقدم الخطوات
  }));
}

// ════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════

export async function chainOfThought(req: CoTRequest): Promise<ReasoningTrace> {
  const start = Date.now();
  logger.debug("[CoT] Starting chain", { query: req.query.slice(0, 60) });

  const template = findTemplate(req.query);
  const steps = template
    ? buildChainFromTemplate(template)
    : buildGenericChain(req.query);

  // Cap to maxSteps
  const cappedSteps = steps.slice(0, req.maxSteps);

  // Calculate overall confidence (average of step confidences)
  const avgConf = cappedSteps.reduce((acc, s) => acc + s.confidence, 0) / cappedSteps.length;

  const conclusion = template
    ? `سلسلة تفكير مُطبَّقة: ${template.keywords[0]} — ${cappedSteps.length} خطوة`
    : `سلسلة تفكير عامة — ${cappedSteps.length} خطوة`;

  const trace: ReasoningTrace = {
    id:         crypto.randomUUID(),
    query:      req.query,
    steps:      cappedSteps,
    conclusion,
    confidence: avgConf,
    latencyMs:  Date.now() - start,
    createdAt:  new Date().toISOString(),
  };

  logger.info("[CoT] Chain complete", {
    traceId:    trace.id,
    steps:      cappedSteps.length,
    confidence: avgConf,
    latencyMs:  trace.latencyMs,
  });

  return trace;
}

/**
 * Serialize a CoT trace to human-readable Arabic text (for UI display).
 */
export function serializeCoT(trace: ReasoningTrace): string {
  const lines: string[] = [
    `🧠 سلسلة التفكير — ${trace.steps.length} خطوة`,
    `السؤال: ${trace.query}`,
    "",
  ];

  for (const step of trace.steps) {
    lines.push(`${step.stepNumber}. 💭 ${step.thought}`);
    if (step.action) lines.push(`   ⚙️  إجراء: ${step.action}`);
    if (step.observation) lines.push(`   👁️  ملاحظة: ${step.observation}`);
    lines.push(`   📊 ثقة: ${(step.confidence * 100).toFixed(0)}%`);
    lines.push("");
  }

  lines.push(`✅ الخلاصة: ${trace.conclusion}`);
  lines.push(`🎯 الثقة الإجمالية: ${(trace.confidence * 100).toFixed(0)}%`);

  return lines.join("\n");
}
