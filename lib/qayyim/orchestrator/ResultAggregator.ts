/**
 * ResultAggregator — تجميع نتائج وكلاء السرب في مسودة موحدة
 *
 * يستقبل Map<agentKey, QayyimResult> → يدمج → يبني AggregatedDraft مع evidenceUrls
 */

import { askOrchestratorMessages } from "@/lib/ai-orchestrator";
import type { QayyimResult } from "../QayyimAgentBase";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AggregatedSection {
  sectionKey: string;
  sectionType:
    | "hero"
    | "content"
    | "images"
    | "seo"
    | "ux"
    | "product_card"
    | "navigation"
    | "mixed";
  content: any;
  agentKey: string;
  evidenceUrls: string[];
  identityCompliant: boolean;
}

export interface AggregatedDraft {
  pagePath: string;
  sections: AggregatedSection[];
  overallSummary: string;
  allEvidenceUrls: string[];
  suggestedNextActions: string[];
  qualityScore: number; // 0-1
  identityViolations: string[];
  version: number;
  createdAt: string;
}

export interface AggregationInput {
  agentResults: Map<string, QayyimResult>;
  userRequest: string;
  pagePath?: string;
  context?: Record<string, any>;
}

// ── Agent → section type mapping ──────────────────────────────────────────────

const AGENT_SECTION_TYPE: Record<string, AggregatedSection["sectionType"]> = {
  "qayyim-cont": "content",
  "qayyim-vis": "images",
  "qayyim-seo": "seo",
  "qayyim-ux": "ux",
  "qayyim-ana": "mixed",
  "qayyim-dev": "mixed",
  "qayyim-qa": "mixed",
  "qayyim-core": "mixed",
};

// ── Main class ────────────────────────────────────────────────────────────────

export class ResultAggregator {
  /**
   * Aggregate all agent results into one unified draft.
   */
  async aggregate(input: AggregationInput): Promise<AggregatedDraft> {
    const { agentResults, userRequest, pagePath = "/", context = {} } = input;

    // 1. Build sections from each agent's result
    const sections: AggregatedSection[] = [];
    const allEvidenceUrls: string[] = [];
    const identityViolations: string[] = [];
    let qualityScoreSum = 0;
    let qualityCount = 0;

    for (const [agentKey, result] of agentResults) {
      if (!result.success) continue;

      const section: AggregatedSection = {
        sectionKey: agentKey.replace("qayyim-", ""),
        sectionType: AGENT_SECTION_TYPE[agentKey] ?? "mixed",
        content: result.data ?? result.output,
        agentKey,
        evidenceUrls: result.evidenceUrls ?? [],
        identityCompliant: !result.output?.toLowerCase().includes("مخالفة"),
      };

      sections.push(section);
      allEvidenceUrls.push(...(result.evidenceUrls ?? []));

      if (!section.identityCompliant) {
        identityViolations.push(
          `${agentKey}: احتمال مخالفة هوية`
        );
      }

      if (result.confidence !== undefined) {
        qualityScoreSum += result.confidence;
        qualityCount++;
      }
    }

    const qualityScore =
      qualityCount > 0 ? qualityScoreSum / qualityCount : 0.75;

    // 2. Generate a unified summary (fast AI call)
    const overallSummary = await this.buildSummary(
      agentResults,
      userRequest,
      sections
    );

    // 3. Collect next actions from all results
    const suggestedNextActions = Array.from(agentResults.values())
      .flatMap((r) => r.nextActions ?? [])
      .filter((v, i, arr) => arr.indexOf(v) === i) // unique
      .slice(0, 5);

    return {
      pagePath,
      sections,
      overallSummary,
      allEvidenceUrls: [...new Set(allEvidenceUrls)],
      suggestedNextActions,
      qualityScore,
      identityViolations,
      version: 1,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Build a concise human-readable Arabic summary of all agent outputs.
   */
  private async buildSummary(
    agentResults: Map<string, QayyimResult>,
    userRequest: string,
    sections: AggregatedSection[]
  ): Promise<string> {
    if (agentResults.size === 0) {
      return "لم يعد أي وكيل بنتائج قابلة للتجميع.";
    }

    // If only one agent responded, use its output directly
    if (agentResults.size === 1) {
      const [, result] = [...agentResults][0];
      return result.output ?? "تم تنفيذ المهمة بنجاح.";
    }

    // Multi-agent: synthesise with AI
    const summaries = [...agentResults.entries()]
      .filter(([, r]) => r.success)
      .map(
        ([key, r]) =>
          `**${key}**: ${(r.output ?? "").slice(0, 400)}`
      )
      .join("\n\n");

    const prompt = `الطلب الأصلي: "${userRequest}"

نتائج الوكلاء:
${summaries}

اكتب ملخصاً تنفيذياً موحداً باللغة العربية الفاخرة في 3-5 جمل فقط. لا تكرر الوكلاء بالاسم.`;

    try {
      const result = await askOrchestratorMessages(
        [
          {
            role: "system",
            content:
              "أنت قيّم الدار - القائد. لخّص نتائج السرب بعربية فاخرة مختصرة.",
          },
          { role: "user", content: prompt },
        ],
        { temperature: 0.4, maxTokens: 512 }
      );
      return result.content ?? this.fallbackSummary(agentResults);
    } catch {
      return this.fallbackSummary(agentResults);
    }
  }

  /** Fallback summary without AI */
  private fallbackSummary(agentResults: Map<string, QayyimResult>): string {
    const succeeded = [...agentResults.values()].filter((r) => r.success)
      .length;
    const total = agentResults.size;
    return `اكتمل السرب: ${succeeded}/${total} وكيل أنجز مهمته بنجاح. راجع نتائج كل قسم لمزيد من التفاصيل.`;
  }

  /**
   * Merge two AggregatedDrafts (for incremental updates).
   */
  merge(base: AggregatedDraft, patch: AggregatedDraft): AggregatedDraft {
    const mergedSections = [...base.sections];
    for (const patchSection of patch.sections) {
      const existingIdx = mergedSections.findIndex(
        (s) => s.sectionKey === patchSection.sectionKey
      );
      if (existingIdx >= 0) {
        mergedSections[existingIdx] = patchSection;
      } else {
        mergedSections.push(patchSection);
      }
    }

    return {
      ...base,
      sections: mergedSections,
      allEvidenceUrls: [
        ...new Set([...base.allEvidenceUrls, ...patch.allEvidenceUrls]),
      ],
      suggestedNextActions: [
        ...new Set([
          ...base.suggestedNextActions,
          ...patch.suggestedNextActions,
        ]),
      ].slice(0, 5),
      qualityScore: (base.qualityScore + patch.qualityScore) / 2,
      identityViolations: [
        ...new Set([...base.identityViolations, ...patch.identityViolations]),
      ],
      overallSummary: patch.overallSummary,
      version: base.version + 1,
    };
  }
}

export const resultAggregator = new ResultAggregator();
