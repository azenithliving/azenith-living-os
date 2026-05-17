/**
 * Sovereign Mind — background observe → think → propose (with permission).
 * Runs on cron; learns from outcomes via agent_memory.
 */

import { createClient } from "@supabase/supabase-js";
import { askOrchestratorMessages } from "./ai-orchestrator";
import { getSystemHealth, getAnalyticsReport } from "./architect-tools";
import { listAssistantExecutions } from "./admin-assistant-log";
import { runAutonomousMonitoring } from "./proactive-agent";
import { riskLevelForIntent, requiresOwnerApproval } from "./admin-approval-policy";
import type { ClassifiedIntent } from "./admin-intent-types";
import type { AdminProposalMetadata } from "./admin-approved-executor";
import { heuristicClassify } from "./admin-intent-classifier";
import { runCapabilityEvolutionCycle } from "./admin-capability-evolution";

export interface MindProposal {
  title: string;
  description: string;
  reasoning: string;
  intent: ClassifiedIntent;
  userMessage: string;
  priority: "low" | "medium" | "high";
}

export interface SovereignMindCycleResult {
  timestamp: string;
  observations: Record<string, unknown>;
  proposalsCreated: number;
  proposals: MindProposal[];
  thoughts: string;
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function gatherObservations(): Promise<Record<string, unknown>> {
  const [health, analytics, monitoring, recentExec] = await Promise.all([
    getSystemHealth().catch((e) => ({ success: false, error: String(e) })),
    getAnalyticsReport({ days: 7 }).catch((e) => ({ success: false, error: String(e) })),
    runAutonomousMonitoring().catch((e) => ({
      findings: [],
      suggestionsGenerated: 0,
      error: String(e),
    })),
    listAssistantExecutions(undefined, 10),
  ]);

  const failed = recentExec.filter(
    (e) => e.execution_status === "failed" || e.execution_status === "error"
  );

  const pendingCount = await countPendingProposals();

  return {
    health,
    analyticsSummary:
      analytics && "message" in analytics && analytics.message
        ? String(analytics.message).slice(0, 500)
        : null,
    monitoringFindings: "findings" in monitoring ? monitoring.findings?.slice(0, 8) : [],
    monitoringSuggestions: "suggestionsGenerated" in monitoring ? monitoring.suggestionsGenerated : 0,
    recentFailures: failed.length,
    pendingApprovals: pendingCount,
    at: new Date().toISOString(),
  };
}

async function countPendingProposals(): Promise<number> {
  const supabase = getServiceSupabase();
  if (!supabase) return 0;
  const { count } = await supabase
    .from("approval_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count || 0;
}

export async function thinkAndPropose(
  observations: Record<string, unknown>,
  options?: { maxProposals?: number; ownerEmail?: string }
): Promise<{ thoughts: string; proposals: MindProposal[] }> {
  const max = options?.maxProposals ?? 3;
  const pending = (observations.pendingApprovals as number) || 0;
  if (pending >= 8) {
    return {
      thoughts:
        "لديّ اقتراحات كثيرة بانتظار موافقتك — سأنتظر حتى تراجعها قبل اقتراح المزيد.",
      proposals: [],
    };
  }

  const system = `أنت «عقل Azenith» — شريك المالك. تفكر في الخلفية وتقترح إجراءات حقيقية (ليست وهمية).
قواعد:
- كل اقتراح يحتاج موافقة المالك قبل التنفيذ
- اقترح فقط ما يمكن تنفيذه: أوامر إدارة، أدوات، وكلاء، genesis، تحليلات
- أخرج JSON فقط:
{
  "thoughts": "فقرة قصيرة: ماذا لاحظت وماذا تتوقع",
  "proposals": [
    {
      "title": "عنوان قصير",
      "description": "ما سأفعله بالضبط",
      "reasoning": "لماذا الآن",
      "userMessage": "الجملة التي يُنفَّذ بها (عربي)",
      "priority": "low|medium|high"
    }
  ]
}
حد أقصى ${max} اقتراحات. لا تكرر اقتراحات عامة بلا فائدة.`;

  const user = `ملاحظات النظام:\n${JSON.stringify(observations, null, 2).slice(0, 6000)}`;

  const ai = await askOrchestratorMessages(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.35, maxTokens: 1200, jsonMode: true }
  );

  if (!ai.success || !ai.content) {
    return {
      thoughts: "أراقب النظام — لم أتمكن من توليد اقتراحات جديدة هذه الدورة.",
      proposals: fallbackProposals(observations),
    };
  }

  try {
    const raw = ai.content.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(raw) as {
      thoughts?: string;
      proposals?: Array<{
        title: string;
        description: string;
        reasoning: string;
        userMessage: string;
        priority?: string;
      }>;
    };

    const proposals: MindProposal[] = (parsed.proposals || [])
      .slice(0, max)
      .map((p) => {
        const intent =
          heuristicClassify(p.userMessage) || {
            kind: "agents" as const,
            confidence: 0.7,
            reasoning: "mind-fallback",
          };
        return {
          title: p.title,
          description: p.description,
          reasoning: p.reasoning,
          userMessage: p.userMessage,
          intent,
          priority: (["low", "medium", "high"].includes(p.priority || "")
            ? p.priority
            : "medium") as "low" | "medium" | "high",
        };
      });

    return {
      thoughts: parsed.thoughts || "أفكر باستمرار في تحسين الموقع.",
      proposals,
    };
  } catch {
    return {
      thoughts: "أراقب — حدثت مشكلة في تحليل الدورة.",
      proposals: fallbackProposals(observations),
    };
  }
}

function fallbackProposals(obs: Record<string, unknown>): MindProposal[] {
  const out: MindProposal[] = [];
  if ((obs.recentFailures as number) > 0) {
    out.push({
      title: "فحص المفاتيح بعد أخطاء حديثة",
      description: "سأفحص مفاتيح API وأبلغك بالحالة",
      reasoning: "هناك تنفيذات فاشلة في سجل المساعد",
      userMessage: "فحص المفاتيح",
      intent: {
        kind: "command",
        command: "check_keys",
        commandLine: "check_keys",
        confidence: 0.9,
      },
      priority: "high",
    });
  }
  if (out.length === 0) {
    out.push({
      title: "مراجعة صحة النظام",
      description: "فحص شامل لصحة الموقع والخدمات",
      reasoning: "مراجعة دورية وقائية",
      userMessage: "هل الموقع شغال تمام؟ افحص صحة النظام",
      intent: { kind: "health", confidence: 0.85 },
      priority: "low",
    });
  }
  return out.slice(0, 2);
}

export async function createAdminProposal(params: {
  title: string;
  description: string;
  reasoning?: string;
  userMessage: string;
  intent: ClassifiedIntent;
  userId?: string;
  userEmail?: string;
  proactive?: boolean;
  suggestionId?: string;
}): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return { success: false, error: "Database not configured" };
  }

  const metadata: AdminProposalMetadata = {
    executor: "admin_assistant",
    intent: params.intent,
    userMessage: params.userMessage,
    userEmail: params.userEmail,
    userId: params.userId,
    reasoning: params.reasoning,
    proactive: params.proactive,
    suggestionId: params.suggestionId,
  };

  const risk = riskLevelForIntent(params.intent);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  const row = {
    action_id: crypto.randomUUID(),
    action_type: `assistant_${params.intent.kind}`,
    description: `${params.title}\n\n${params.description}`,
    risk_level: risk,
    requested_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    status: "pending",
    metadata,
    actor_user_id: params.userId || null,
    company_id: process.env.MASTER_COMPANY_ID || null,
  };

  const { data, error } = await supabase
    .from("approval_requests")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    const legacy = { ...row } as Record<string, unknown>;
    delete legacy.actor_user_id;
    delete legacy.company_id;
    const retry = await supabase.from("approval_requests").insert(legacy).select("id").single();
    if (retry.error) return { success: false, error: retry.error.message };
    return { success: true, requestId: retry.data?.id };
  }

  return { success: true, requestId: data?.id };
}

export async function runSovereignMindCycle(options?: {
  ownerEmail?: string;
  ownerId?: string;
}): Promise<SovereignMindCycleResult> {
  const observations = await gatherObservations();
  const { report: maturity, proposals: evolutionProposals } =
    await runCapabilityEvolutionCycle();
  observations.capabilityMaturity = maturity;

  const { thoughts, proposals: aiProposals } = await thinkAndPropose(observations, {
    ownerEmail: options?.ownerEmail,
  });
  const proposals = [...aiProposals, ...evolutionProposals].slice(0, 5);

  let created = 0;
  for (const p of proposals) {
    const r = await createAdminProposal({
      title: p.title,
      description: p.description,
      reasoning: p.reasoning,
      userMessage: p.userMessage,
      intent: p.intent,
      userId: options?.ownerId,
      userEmail: options?.ownerEmail,
      proactive: true,
    });
    if (r.success) created++;
  }

  try {
    const { storeMemory } = await import("./ultimate-agent/memory-store");
    await storeMemory({
      type: "learning",
      category: "sovereign_mind_cycle",
      content: `${thoughts}\n\nاقتراحات جديدة: ${created}`,
      priority: created > 0 ? "high" : "normal",
      context: { observations, proposalsCreated: created },
    });
  } catch {
    /* optional */
  }

  return {
    timestamp: new Date().toISOString(),
    observations,
    proposalsCreated: created,
    proposals,
    thoughts,
  };
}

export async function listPendingAdminProposals(limit = 20) {
  const supabase = getServiceSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("status", "pending")
    .like("action_type", "assistant_%")
    .order("requested_at", { ascending: false })
    .limit(limit);

  return data || [];
}

