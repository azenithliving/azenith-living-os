/**
 * lib/vanguard/reasoning/tree_of_thought.ts
 * ==========================================
 * Tree-of-Thought (ToT) — التفكير المتشعب مع استكشاف فروع متعددة.
 *
 * يختبر عدة مسارات تفكير متوازية ويختار الأفضل بناءً على الثقة.
 * مفيد للقرارات المعقدة مثل: اختيار استراتيجية تسعير، رد على اعتراض.
 *
 * Pattern: Root → Branch1/Branch2/Branch3 → Evaluate → Choose Best
 */

import {
  type ReasoningTrace,
  type ThoughtStep,
} from "@/lib/vanguard/types";
import { logger } from "@/lib/vanguard/observability/logger";

// ════════════════════════════════════════════════════════════
// TOT REQUEST
// ════════════════════════════════════════════════════════════

export interface ToTRequest {
  readonly query:       string;
  readonly context:     Record<string, unknown>;
  readonly maxDepth:    number;
  readonly temperature: number;
}

interface TreeNode {
  readonly id:          string;
  readonly thought:     string;
  readonly action:      string | null;
  readonly observation: string | null;
  confidence:           number;
  children:             TreeNode[];
  readonly depth:       number;
}

// ════════════════════════════════════════════════════════════
// BRANCH TEMPLATES
// Predefined decision trees for common scenarios.
// ════════════════════════════════════════════════════════════

interface BranchTemplate {
  readonly keywords: string[];
  readonly root:     string;
  readonly branches: Array<{
    thought:     string;
    action:      string;
    observation: string;
    confidence:  number;
  }>;
}

const TOT_TEMPLATES: BranchTemplate[] = [
  {
    keywords: ["اعتراض", "غالي", "سعر", "تمن"],
    root:     "العميل يعترض على السعر — استكشاف استراتيجيات الرد",
    branches: [
      {
        thought:     "التأكيد على الجودة والحرفية",
        action:      "emphasize_quality",
        observation: "يُبرز قيمة المواد الفاخرة والتصنيع المصري",
        confidence:  0.85,
      },
      {
        thought:     "تقديم خيارات تقسيط مرنة",
        action:      "offer_installment",
        observation: "يُقلل الحاجز المالي الفوري",
        confidence:  0.80,
      },
      {
        thought:     "مقارنة بالمنافسين (جودة مقابل سعر)",
        action:      "compare_competitors",
        observation: "يُظهر تفوق أزينث في الجودة بسعر معقول",
        confidence:  0.75,
      },
      {
        thought:     "توضيح أن السعر يشمل التخصيص والضمان",
        action:      "explain_inclusions",
        observation: "يُبين القيمة الكاملة للعرض",
        confidence:  0.78,
      },
    ],
  },
  {
    keywords: ["حائر", "مش عارف", "مش متأكد", "محتار"],
    root:     "العميل غير متأكد — استكشاف طرق المساعدة",
    branches: [
      {
        thought:     "طرح أسئلة تأهيلية لتوضيح الاحتياج",
        action:      "ask_qualifying_questions",
        observation: "يُساعد العميل على تحديد ما يريد بالضبط",
        confidence:  0.90,
      },
      {
        thought:     "عرض صور ملهمة من مشاريع سابقة",
        action:      "show_portfolio",
        observation: "يُعطي العميل أمثلة ملموسة",
        confidence:  0.85,
      },
      {
        thought:     "اقتراح جدولة زيارة للصالة",
        action:      "schedule_showroom_visit",
        observation: "يتيح للعميل رؤية المواد واللمس",
        confidence:  0.88,
      },
      {
        thought:     "تقديم مقارنة أنماط (classic vs modern)",
        action:      "compare_styles",
        observation: "يُبسط القرار بين خيارين واضحين",
        confidence:  0.82,
      },
    ],
  },
];

// ════════════════════════════════════════════════════════════
// TREE BUILDING
// ════════════════════════════════════════════════════════════

function findBranchTemplate(query: string): BranchTemplate | null {
  const lower = query.toLowerCase();
  for (const template of TOT_TEMPLATES) {
    if (template.keywords.some((kw) => lower.includes(kw))) {
      return template;
    }
  }
  return null;
}

function buildTree(template: BranchTemplate | null, query: string, maxDepth: number): TreeNode {
  if (!template) {
    // Generic tree: root + 2 simple branches
    return {
      id:          crypto.randomUUID(),
      thought:     `استكشاف حلول متعددة لـ: "${query.slice(0, 50)}"`,
      action:      null,
      observation: null,
      confidence:  0.7,
      depth:       0,
      children: [
        {
          id:          crypto.randomUUID(),
          thought:     "الحل المباشر: الرد بشكل مباشر بناءً على المعرفة المتاحة",
          action:      "direct_answer",
          observation: "سريع لكن قد يحتاج تحقق إضافي",
          confidence:  0.75,
          depth:       1,
          children:    [],
        },
        {
          id:          crypto.randomUUID(),
          thought:     "الحل المُتحقَّق: البحث في Knowledge Graph أولاً",
          action:      "verified_answer",
          observation: "أبطأ لكن أكثر دقة ومصداقية",
          confidence:  0.85,
          depth:       1,
          children:    [],
        },
      ],
    };
  }

  // Build tree from template
  const children: TreeNode[] = template.branches.map((b) => ({
    id:          crypto.randomUUID(),
    thought:     b.thought,
    action:      b.action,
    observation: b.observation,
    confidence:  b.confidence,
    depth:       1,
    children:    [],
  }));

  return {
    id:          crypto.randomUUID(),
    thought:     template.root,
    action:      null,
    observation: null,
    confidence:  0.8,
    depth:       0,
    children,
  };
}

function selectBestBranch(tree: TreeNode): TreeNode {
  if (tree.children.length === 0) return tree;
  // Sort by confidence descending
  const sorted = [...tree.children].sort((a, b) => b.confidence - a.confidence);
  return sorted[0];
}

function treeToSteps(tree: TreeNode, bestBranch: TreeNode): ThoughtStep[] {
  const steps: ThoughtStep[] = [];

  // Root node
  steps.push({
    stepNumber:  1,
    thought:     tree.thought,
    action:      tree.action,
    observation: tree.observation,
    confidence:  tree.confidence,
  });

  // All branches (showing exploration)
  for (let i = 0; i < tree.children.length; i++) {
    const branch = tree.children[i];
    steps.push({
      stepNumber:  2 + i,
      thought:     `فرع ${i + 1}: ${branch.thought}`,
      action:      branch.action,
      observation: branch.observation,
      confidence:  branch.confidence,
    });
  }

  // Selected branch
  steps.push({
    stepNumber:  2 + tree.children.length,
    thought:     `✅ الفرع المختار: ${bestBranch.thought}`,
    action:      "select_best_branch",
    observation: `الثقة: ${(bestBranch.confidence * 100).toFixed(0)}% — هذا الفرع الأنسب`,
    confidence:  bestBranch.confidence,
  });

  return steps;
}

// ════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════

export async function treeOfThought(req: ToTRequest): Promise<ReasoningTrace> {
  const start = Date.now();
  logger.debug("[ToT] Starting tree exploration", { query: req.query.slice(0, 60) });

  const template = findBranchTemplate(req.query);
  const tree     = buildTree(template, req.query, req.maxDepth);
  const best     = selectBestBranch(tree);
  const steps    = treeToSteps(tree, best);

  const avgConf = steps.reduce((acc, s) => acc + s.confidence, 0) / steps.length;

  const trace: ReasoningTrace = {
    id:         crypto.randomUUID(),
    query:      req.query,
    steps,
    conclusion: `شجرة تفكير استكشفت ${tree.children.length} فرع — اختير: ${best.thought}`,
    confidence: avgConf,
    latencyMs:  Date.now() - start,
    createdAt:  new Date().toISOString(),
  };

  logger.info("[ToT] Tree exploration complete", {
    traceId:    trace.id,
    branches:   tree.children.length,
    bestBranch: best.thought.slice(0, 40),
    confidence: avgConf,
    latencyMs:  trace.latencyMs,
  });

  return trace;
}

/**
 * Serialize ToT trace to human-readable Arabic text.
 */
export function serializeToT(trace: ReasoningTrace): string {
  const lines: string[] = [
    `🌳 شجرة التفكير — استكشاف متعدد الفروع`,
    `السؤال: ${trace.query}`,
    "",
  ];

  for (const step of trace.steps) {
    const prefix = step.thought.startsWith("✅") ? "" : step.thought.startsWith("فرع") ? "  🔀 " : "🎯 ";
    lines.push(`${step.stepNumber}. ${prefix}${step.thought}`);
    if (step.action) lines.push(`     ⚙️  ${step.action}`);
    if (step.observation) lines.push(`     💬 ${step.observation}`);
    lines.push(`     📊 ثقة: ${(step.confidence * 100).toFixed(0)}%`);
    lines.push("");
  }

  lines.push(`✅ ${trace.conclusion}`);
  lines.push(`🎯 الثقة الإجمالية: ${(trace.confidence * 100).toFixed(0)}%`);

  return lines.join("\n");
}
