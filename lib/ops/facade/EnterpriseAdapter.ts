/**
 * EnterpriseAdapter — يجعل Qayyim يظهر كوكيل واحد مثل Vanguard
 * يُستخدم في AgentOrchestrator و mastermind/stats
 */

import { QAYYIM_ENTERPRISE_META } from "./QayyimFacade";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePrimaryCompanyId } from "@/lib/company-resolver";

export const ENTERPRISE_KEYS = ["qayyim", "vanguard", "analyst", "coder", "ops", "security", "learner"] as const;
export type EnterpriseKey = typeof ENTERPRISE_KEYS[number];

export function isEnterpriseKey(key: string): key is EnterpriseKey {
  return (ENTERPRISE_KEYS as readonly string[]).includes(key);
}

export function toEnterpriseKey(raw: string): EnterpriseKey {
  const k = raw.toLowerCase().trim();
  if (k === "prime" || k === "ops-lead" || k === "qayyim") return "qayyim";
  if (isEnterpriseKey(k)) return k as EnterpriseKey;
  return "qayyim"; // default fallback for unknown qayyim sub keys in enterprise view
}

/**
 * يجمع أداء ops-lead + 7 subs في صف واحد للعرض في /admin/v2 (Enterprise)
 */
export async function getEnterpriseAgentsPerformance() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return {};
  const companyId = await resolvePrimaryCompanyId();

  const { data: profiles } = await supabase.from("agent_profiles").select("id, agent_key").eq("company_id", companyId);
  const idByKey = new Map<string, string>();
  (profiles ?? []).forEach((p: any) => idByKey.set(p.agent_key, p.id));

  const qayyimIds = [idByKey.get("ops-lead"), ...QAYYIM_ENTERPRISE_META.subAgents.map(k => idByKey.get(k))].filter(Boolean) as string[];

  const { data: tasks } = await supabase
    .from("agent_tasks")
    .select("id, status, agent_profile_id, started_at, completed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  // Map profile id → enterprise key
  const entKeyByProfileId = new Map<string, EnterpriseKey>();
  for (const [k, id] of idByKey.entries()) {
    if (k === "ops-lead" || QAYYIM_ENTERPRISE_META.subAgents.includes(k)) entKeyByProfileId.set(id, "qayyim");
    else if (isEnterpriseKey(k)) entKeyByProfileId.set(id, k as EnterpriseKey);
  }

  const perf: Record<string, { tasks: number; completed: number; failed: number; avgTime: number; successRate: number }> = {};
  for (const ent of ENTERPRISE_KEYS) perf[ent] = { tasks: 0, completed: 0, failed: 0, avgTime: 0, successRate: 0 };

  const SUCCESS = new Set(["completed", "executed", "success", "done"]);
  const FAILED = new Set(["failed", "error"]);

  for (const t of (tasks ?? []) as any[]) {
    const ent = entKeyByProfileId.get(t.agent_profile_id);
    if (!ent) continue;
    const p = perf[ent];
    p.tasks += 1;
    const s = String(t.status ?? "").toLowerCase();
    if (SUCCESS.has(s)) {
      p.completed += 1;
      if (t.started_at && t.completed_at) {
        const d = new Date(t.completed_at).getTime() - new Date(t.started_at).getTime();
        if (Number.isFinite(d) && d >= 0) p.avgTime += (d - p.avgTime) / p.completed;
      }
    } else if (FAILED.has(s)) p.failed += 1;
  }
  for (const p of Object.values(perf)) {
    p.avgTime = Math.round(p.avgTime);
    p.successRate = p.tasks ? Math.round((p.completed / p.tasks) * 100) : 0;
  }
  return perf;
}
