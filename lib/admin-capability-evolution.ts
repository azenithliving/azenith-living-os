/**
 * Capability maturity & self-improvement loop for the unified admin assistant.
 */

import { TOOL_REGISTRY } from "@/lib/agent-tools/tool-registry";
import { ADMIN_COMMANDS, isLiveTool } from "./admin-capability-manifest";
import { arNum } from "./ops/metricLabels";
import type { ClassifiedIntent } from "./admin-intent-types";
import { reinforceLearnedPattern, listLearnedPatternCount } from "./admin-learned-patterns";
import type { MindProposal } from "./admin-sovereign-mind";

export interface CapabilityMaturityReport {
  tier: "foundational" | "operational" | "advanced" | "sovereign";
  score: number;
  commands: number;
  toolsTotal: number;
  toolsLive: number;
  toolsStub: number;
  learnedPatterns: number;
  summaryAr: string;
}

/**
 * What each maturity level is called on the owner's screen. The keys are for the code.
 * The top level is named for what the score measures — every registered tool answering — and not
 * for sovereignty, which is a claim about authority the number behind it does not make.
 */
export const TIER_LABELS_AR: Record<CapabilityMaturityReport["tier"], string> = {
  foundational: "تحت التأسيس",
  operational: "شغّال",
  advanced: "متقدّم",
  sovereign: "شغّال بالكامل",
};

export function getCapabilityMaturityReport(): CapabilityMaturityReport {
  const tools = Object.values(TOOL_REGISTRY);
  const toolsLive = tools.filter(isLiveTool).length;
  const toolsStub = tools.length - toolsLive;
  const learnedPatterns = listLearnedPatternCount();

  const raw =
    ADMIN_COMMANDS.length * 2 +
    toolsLive * 3 +
    learnedPatterns * 0.5;
  const max = ADMIN_COMMANDS.length * 2 + tools.length * 3 + 20;
  const score = Math.min(100, Math.round((raw / max) * 100));

  let tier: CapabilityMaturityReport["tier"] = "foundational";
  if (score >= 85) tier = "sovereign";
  else if (score >= 65) tier = "advanced";
  else if (score >= 45) tier = "operational";

  const summaryAr = [
    `${TIER_LABELS_AR[tier]}: ${arNum(toolsLive)} أداة شغّالة من ${arNum(tools.length)}، و${arNum(ADMIN_COMMANDS.length)} أمر محفوظ، و${arNum(learnedPatterns)} نمط اتتعلم من تنفيذات فعلية.`,
    ...(toolsStub > 0 ? [`في ${arNum(toolsStub)} أداة لسه ما اشتغلتش.`] : []),
  ].join(" ");

  return {
    tier,
    score,
    commands: ADMIN_COMMANDS.length,
    toolsTotal: tools.length,
    toolsLive,
    toolsStub,
    learnedPatterns,
    summaryAr,
  };
}

export async function recordExecutionLearning(params: {
  message: string;
  intent: ClassifiedIntent;
  success: boolean;
}): Promise<void> {
  if (!params.success) return;
  if (params.intent.kind === "conversation") return;
  reinforceLearnedPattern(params.message, params.intent);
}

export function buildCapabilityEvolutionProposals(
  report: CapabilityMaturityReport
): MindProposal[] {
  const out: MindProposal[] = [];

  if (report.toolsStub > 0) {
    out.push({
      title: "تطوير الأدوات المتبقية",
      description: `ما زال ${report.toolsStub} أداة بحاجة تنفيذ كامل (مثل backup_restore)`,
      reasoning: "رفع نضج النظام",
      userMessage: "evolve",
      intent: {
        kind: "command",
        command: "evolve",
        commandLine: "evolve",
        confidence: 0.85,
      },
      priority: "medium",
    });
  }

  if (report.score < 70) {
    out.push({
      title: "فحص صحة شامل",
      description: "مراجعة الخدمات والمهام المعلقة",
      reasoning: "تعزيز الاستقرار قبل توسيع القدرات",
      userMessage: "افحص صحة النظام بفحص تقني عميق",
      intent: {
        kind: "ultimate_tool",
        toolName: "system_health_check",
        toolParams: {},
        confidence: 0.85,
      },
      priority: "high",
    });
  }

  if (report.learnedPatterns < 8) {
    out.push({
      title: "تعلم من آخر أسبوع",
      description: "تحليل التنفيذات الناجحة وتثبيت أنماط جديدة",
      reasoning: "بناء خبرة متراكمة مثل سنوات التشغيل",
      userMessage: "تطور ذاتي من الأخطاء",
      intent: {
        kind: "command",
        command: "evolve",
        commandLine: "evolve",
        confidence: 0.8,
      },
      priority: "low",
    });
  }

  return out.slice(0, 2);
}

export async function runCapabilityEvolutionCycle(): Promise<{
  report: CapabilityMaturityReport;
  proposals: MindProposal[];
}> {
  const { hydrateLearnedPatternsFromDb } = await import("./admin-learned-patterns");
  await hydrateLearnedPatternsFromDb().catch(() => {});
  const report = getCapabilityMaturityReport();
  return { report, proposals: buildCapabilityEvolutionProposals(report) };
}
