/**
 * QayyimFacade — الواجهة الموحدة لقيّم الدار (Enterprise)
 * هو الوكيل الوحيد الظاهر في الداشبورد — الـ 7 الآخرون يعملون خفياً
 * $0 — يعتمد على MasterOrchestrator + Postgres فقط
 */

import { masterOrchestrator } from "../orchestrator/MasterOrchestrator";
import { qayyimCoreAgent } from "../QayyimCoreAgent";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";

export type QayyimScope = "enterprise" | "swarm";

export interface EnterpriseAgentMeta {
  key: "qayyim";
  name: "قيّم الدار";
  nameEn: "Qayyim";
  icon: "👑";
  color: "amber";
  subAgents: string[]; // 7 internal keys
  role: string;
}

export const QAYYIM_ENTERPRISE_META: EnterpriseAgentMeta = {
  key: "qayyim",
  name: "قيّم الدار",
  nameEn: "Qayyim",
  icon: "👑",
  color: "amber",
  subAgents: ["qayyim-cont", "qayyim-vis", "qayyim-seo", "qayyim-ux", "qayyim-ana", "qayyim-dev", "qayyim-qa"],
  role: "قيّم إطلالة أزينث — قائد سرب (7 وكلاء خفيين)",
};

export class QayyimFacade {
  /**
   * Chat موحد — أي رسالة من المستخدم تمر عبر القائد، وهو يوزع خفياً
   */
  async chat(message: string, context?: Record<string, any>): Promise<{
    success: boolean;
    response: string;
    evidenceUrls: string[];
    draft?: any;
    version?: number;
    taskId?: string;
    swarmAgents?: string[];
  }> {
    const companyId = await resolveAdminCompanyId(context?.company_id);

    // Prime alias → qayyim (soft redirect)
    // inferUltimateTool inside AgentOrchestrator already handles, but we normalize here too

    // استخدم MasterOrchestrator (LangGraph) — هو يفكك ويوزع على 7 خفياً
    try {
      const result = await masterOrchestrator.execute(message, {
        ...context,
        company_id: companyId,
        source: context?.source ?? "facade",
        facade: "qayyim",
      });

      return {
        success: result.success,
        response: result.response,
        evidenceUrls: result.evidenceUrls ?? [],
        draft: result.draft ?? null,
        version: result.version,
        taskId: result.taskId,
        swarmAgents: (result.draft?.sections?.map((s: any) => s.agentKey) ?? []) as string[],
      };
    } catch (err: any) {
      // Fallback لقائد مباشر لو السرب ساقط
      const fallback = await qayyimCoreAgent.chat(message, { ...context, company_id: companyId });
      return { success: true, response: fallback, evidenceUrls: [], taskId: `fallback_${Date.now()}` };
    }
  }

  /**
   * حالة السرب الداخلية — تُستدعى فقط داخل الاستوديو
   */
  async getSwarmStatus(companyHint?: string | null): Promise<{
    leader: { key: string; status: string; lastActivity: string | null };
    subs: Array<{ key: string; name: string; status: string; lastTaskAt: string | null; tasks24h: number }>;
  }> {
    const supabase = getSupabaseAdminClient();
    const companyId = await resolveAdminCompanyId(companyHint ?? undefined);
    if (!supabase || !companyId) {
      return { leader: { key: "qayyim-core", status: "offline", lastActivity: null }, subs: [] };
    }

    // اقرأ profiles للسرب (8)
    const { data: profiles } = await supabase
      .from("agent_profiles")
      .select("id, agent_key, updated_at")
      .in("agent_key", ["qayyim-core", ...QAYYIM_ENTERPRISE_META.subAgents])
      .eq("company_id", companyId);

    const idByKey = new Map<string, string>();
    (profiles ?? []).forEach((p: any) => idByKey.set(p.agent_key, p.id));

    // اقرأ tasks last 24h لكل وكيل
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: tasks } = await supabase
      .from("agent_tasks")
      .select("agent_profile_id, created_at, status")
      .gte("created_at", since)
      .in("agent_profile_id", Array.from(idByKey.values()))
      .order("created_at", { ascending: false })
      .limit(200);

    const tasksByProfile = new Map<string, any[]>();
    (tasks ?? []).forEach((t: any) => {
      const arr = tasksByProfile.get(t.agent_profile_id) ?? [];
      arr.push(t);
      tasksByProfile.set(t.agent_profile_id, arr);
    });

    const subs = QAYYIM_ENTERPRISE_META.subAgents.map((key) => {
      const pid = idByKey.get(key);
      const t = pid ? tasksByProfile.get(pid) ?? [] : [];
      return {
        key,
        name: key.replace("qayyim-", ""),
        status: t.length > 0 && t[0].status === "running" ? "busy" : t.length > 0 ? "online" : "idle",
        lastTaskAt: t[0]?.created_at ?? null,
        tasks24h: t.length,
      };
    });

    const leaderId = idByKey.get("qayyim-core");
    const leaderTasks = leaderId ? tasksByProfile.get(leaderId) ?? [] : [];
    return {
      leader: {
        key: "qayyim-core",
        status: leaderTasks.length > 0 && leaderTasks[0].status === "running" ? "busy" : "online",
        lastActivity: leaderTasks[0]?.created_at ?? null,
      },
      subs,
    };
  }

  /**
   * تحويل legacy prime → qayyim في أي payload يصل من UI قديم
   */
  normalizeAgentKey(key: string): string {
    if (!key) return "qayyim";
    const k = key.toLowerCase().trim();
    if (k === "prime") return "qayyim";
    if (k === "qayyim-core") return "qayyim";
    if (k.startsWith("qayyim-")) return k; // sub-agent inside studio only
    return k;
  }
}

export const qayyimFacade = new QayyimFacade();
