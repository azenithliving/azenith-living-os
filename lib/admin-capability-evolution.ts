/**
 * Capability maturity & self-improvement loop for the unified admin assistant.
 */

import { TOOL_REGISTRY } from "@/lib/agent-tools/tool-registry";
import { ADMIN_COMMANDS } from "./admin-capability-manifest";
import type { ClassifiedIntent } from "./admin-intent-types";
import { reinforceLearnedPattern, listLearnedPatternCount } from "./admin-learned-patterns";
import type { MindProposal } from "./admin-sovereign-mind";

const STUB_RE = /not yet implemented/i;

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

export function getCapabilityMaturityReport(): CapabilityMaturityReport {
  const tools = Object.values(TOOL_REGISTRY);
  const toolsLive = tools.filter(
    (t) => !STUB_RE.test(String(t.handler))
  ).length;
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

  const summaryAr =
    tier === "sovereign"
      ? "المساعد يعمل بمستوى تشغيل كامل: أوامر، أدوات حية، وتعلم من التنفيذات."
      : tier === "advanced"
        ? `قوي جداً: ${toolsLive} أداة حية من ${tools.length}، مع تعلم مستمر.`
        : `جيد: ${toolsStub} أداة ما زالت تحتاج تطويراً إضافياً.`;

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
