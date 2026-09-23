/**
 * TaskDecomposer — تفكيك طلبات المستخدم إلى مهام فرعية موزعة على وكلاء السرب
 *
 * يستقبل طلباً بالعربية → يحدد الوكلاء المطلوبين → يبني قائمة SubTask مرتبة
 */

import { askOrchestratorMessages } from "@/lib/ai-orchestrator";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DecomposedSubTask {
  agentKey: string;
  type: string;
  title: string;
  description: string;
  context: Record<string, any>;
  priority: "low" | "medium" | "high" | "critical";
  dependsOn: string[]; // IDs of subtasks that must complete first
}

export interface DecompositionResult {
  subtasks: DecomposedSubTask[];
  estimatedAgents: string[];
  complexity: "simple" | "moderate" | "complex";
  reasoning: string;
}

// ── Keyword routing map (zero-cost, no AI needed for simple requests) ────────

const AGENT_KEYWORDS: Record<string, string[]> = {
  "qayyim-core": [
    "افحص الموقع", "تدقيق شامل", "انشر", "تراجع", "بوابة جودة", "نسّق السرب",
    "audit", "publish", "rollback", "quality gate", "coordinate",
  ],
  "qayyim-cont": [
    "نص", "اكتب", "صياغة", "هوية", "نبرة", "عربي", "فاخر", "هيرو",
    "hero text", "copy", "tone", "identity", "arabic",
  ],
  "qayyim-vis": [
    "صورة", "صور", "معرض", "هيرو صورة", "alt text", "بصري", "علامة تجارية",
    "image", "gallery", "visual", "brand",
  ],
  "qayyim-seo": [
    "seo", "سيو", "schema", "فهرسة", "محركات بحث", "كلمات مفتاحية", "فجوات",
    "search", "index", "schema.org", "keywords",
  ],
  "qayyim-ux": [
    "سلوك", "خروج", "exit rate", "a/b", "تجربة مستخدم", "تحويل", "تمرير",
    "behavior", "conversion", "scroll", "funnel", "telemetry",
  ],
  "qayyim-ana": [
    "luxury score", "إيرادات", "تحليلات", "تنبؤ", "شرائح", "ربح",
    "revenue", "analytics", "predict", "segment",
  ],
  "qayyim-dev": [
    "أداء", "bundle", "core web vitals", "كود", "تبعيات",
    "performance", "code", "lcp", "cls", "dependencies",
  ],
  "qayyim-qa": [
    "اختبار", "e2e", "visual regression", "a11y", "وصولية", "جودة",
    "test", "smoke", "accessibility", "quality",
  ],
};

// ── Agent capability catalogue ────────────────────────────────────────────────

const AGENT_TASK_TYPES: Record<string, string[]> = {
  "qayyim-core": [
    "audit_full_site", "coordinate_swarm", "publish_draft",
    "rollback_version", "quality_gate",
  ],
  "qayyim-cont": [
    "draft_luxury_copy", "unify_tone", "identity_check",
    "arabic_polish", "copy_review",
  ],
  "qayyim-vis": [
    "curate_gallery", "select_hero_image", "generate_alt_text",
    "brand_consistency_check", "optimize_images",
  ],
  "qayyim-seo": [
    "audit_seo", "fix_schema", "content_gap_analysis",
    "competitor_gap", "schema_generate",
  ],
  "qayyim-ux": [
    "analyze_telemetry", "conversion_funnel", "ab_test_propose",
    "exit_rate_alert", "scroll_depth_analysis",
  ],
  "qayyim-ana": [
    "revenue_correlation", "predict_churn", "segment_analysis",
    "forecast_conversion", "luxury_score",
  ],
  "qayyim-dev": [
    "perf_audit", "bundle_analyze", "dependency_check",
    "code_quality_gate", "type_safety_check",
  ],
  "qayyim-qa": [
    "e2e_smoke_test", "visual_regression", "a11y_audit",
    "load_test_staging", "security_scan",
  ],
};

// ── Main class ────────────────────────────────────────────────────────────────

export class TaskDecomposer {
  /**
   * Decompose a user request into subtasks.
   * Tries rule-based first; falls back to AI for complex requests.
   */
  async decompose(
    userRequest: string,
    context: Record<string, any> = {}
  ): Promise<DecompositionResult> {
    const lower = userRequest.toLowerCase();

    // 1. Score agents by keyword hits
    const scores: Record<string, number> = {};
    for (const [agent, keywords] of Object.entries(AGENT_KEYWORDS)) {
      scores[agent] = keywords.filter((kw) => lower.includes(kw)).length;
    }

    const topAgents = Object.entries(scores)
      .filter(([, s]) => s > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([key]) => key);

    // 2. Simple request → rule-based decomposition
    if (topAgents.length > 0 && topAgents.length <= 2) {
      return this.ruleBasedDecomposition(userRequest, topAgents, context);
    }

    // 3. Complex / ambiguous → AI decomposition
    try {
      return await this.aiDecomposition(userRequest, context);
    } catch {
      // Fallback to rule-based with best-guess agent
      const fallbackAgents = topAgents.length > 0 ? topAgents : ["qayyim-core"];
      return this.ruleBasedDecomposition(userRequest, fallbackAgents, context);
    }
  }

  // ── Rule-based (free, instant) ──────────────────────────────────────────────

  private ruleBasedDecomposition(
    userRequest: string,
    agents: string[],
    context: Record<string, any>
  ): DecompositionResult {
    const primaryAgent = agents[0];
    const taskType = AGENT_TASK_TYPES[primaryAgent]?.[0] ?? "audit";

    const subtasks: DecomposedSubTask[] = [
      {
        agentKey: primaryAgent,
        type: taskType,
        title: `${primaryAgent}: ${userRequest.slice(0, 60)}`,
        description: userRequest,
        context,
        priority: "high",
        dependsOn: [],
      },
    ];

    // If multiple agents, add secondary tasks
    for (let i = 1; i < Math.min(agents.length, 3); i++) {
      const agent = agents[i];
      subtasks.push({
        agentKey: agent,
        type: AGENT_TASK_TYPES[agent]?.[0] ?? "audit",
        title: `${agent}: دعم الطلب`,
        description: userRequest,
        context,
        priority: "medium",
        dependsOn: [],
      });
    }

    return {
      subtasks,
      estimatedAgents: agents,
      complexity: agents.length > 1 ? "moderate" : "simple",
      reasoning: `Rule-based routing to: ${agents.join(", ")}`,
    };
  }

  // ── AI-based (for complex multi-agent requests) ────────────────────────────

  private async aiDecomposition(
    userRequest: string,
    context: Record<string, any>
  ): Promise<DecompositionResult> {
    const agentList = Object.entries(AGENT_TASK_TYPES)
      .map(([k, tasks]) => `• ${k}: ${tasks.slice(0, 3).join(", ")}`)
      .join("\n");

    const prompt = `أنت منسق سرب قيّم الدار. فكّك هذا الطلب إلى مهام فرعية:

الطلب: "${userRequest}"

الوكلاء المتاحون:
${agentList}

أعد JSON صارماً بهذا الشكل:
{
  "subtasks": [
    {
      "agentKey": "qayyim-cont",
      "type": "draft_luxury_copy",
      "title": "عنوان مختصر للمهمة",
      "description": "وصف تفصيلي",
      "priority": "high",
      "dependsOn": []
    }
  ],
  "estimatedAgents": ["qayyim-cont"],
  "complexity": "moderate",
  "reasoning": "لماذا اخترت هؤلاء الوكلاء"
}`;

    const result = await askOrchestratorMessages(
      [
        {
          role: "system",
          content:
            "أنت منسق مهام. أعد JSON صارماً فقط، بلا نص إضافي، بلا markdown.",
        },
        { role: "user", content: prompt },
      ],
      { temperature: 0.2, maxTokens: 1024 }
    );

    if (!result.success || !result.content) {
      throw new Error("AI decomposition failed");
    }

    // Strip markdown code fences if present
    const raw = result.content
      .replace(/```(?:json)?/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(raw);

    // Attach context to every subtask
    parsed.subtasks = (parsed.subtasks as DecomposedSubTask[]).map((st) => ({
      ...st,
      context: { ...context, ...(st.context || {}) },
    }));

    return parsed as DecompositionResult;
  }
}

export const taskDecomposer = new TaskDecomposer();
