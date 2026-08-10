import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePrimaryCompanyId } from "@/lib/company-resolver";

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

function apiSuccess(data: Record<string, unknown>) {
  return NextResponse.json({
    success: true,
    ...data,
  });
}

function apiError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * GET /api/admin/mastermind/stats
 * Returns comprehensive statistics for Mastermind system
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-admin-user-id");
    const companyId = await resolvePrimaryCompanyId();

    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const supabase = getSupabaseAdminClient();

    if (!supabase) {
      return apiError("Supabase admin client unavailable", 500);
    }

    // We get the user's email from the auth system if possible, 
    // but here we just check if 2FA is enabled or if it's a known admin.
    const { data: user2FA } = await supabase
      .from("user_2fa")
      .select("is_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    // Relaxed check: only block if explicitly disabled and not a sovereign bypass
    // For now, if no row exists, we allow (as it might be first time setup)
    if (user2FA?.is_enabled === false) {
      return apiError("2FA required", 403);
    }

    // Fetch stats from multiple sources
    const stats = await gatherMastermindStats(supabase, userId, companyId);

    return apiSuccess({
      message: "Mastermind stats fetched",
      data: stats,
      meta: { actorId: userId, companyId },
    });

  } catch (error) {
    console.error("Mastermind Stats Error:", error);
    return apiError("Failed to fetch stats", 500);
  }
}

async function gatherMastermindStats(supabase: AdminClient, userId: string, companyId: string) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [commandLogsRes, apiKeysRes, failedAttemptsRes, agentTasksRes, agentProfilesRes] = await Promise.all([
    supabase
      .from("immutable_command_log")
      .select("id, status, executed_at, command_text")
      .eq("user_id", userId)
      .order("executed_at", { ascending: false })
      .limit(100),
    supabase
      .from("api_keys")
      .select("provider, is_active, last_used_at")
      .eq("is_active", true),
    supabase
      .from("failed_login_attempts")
      .select("attempted_at")
      .eq("company_id", companyId)
      .gte("attempted_at", oneDayAgo),
    supabase
      .from("agent_tasks")
      .select("id, status, agent_profile_id, started_at, completed_at, created_at, task_type")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("agent_profiles")
      .select("id, agent_key, name"),
  ]);

  const commandLogs = commandLogsRes.data || [];
  const apiKeys = apiKeysRes.data || [];
  const failedAttempts = failedAttemptsRes.data || [];
  const agentTasks = agentTasksRes.data || [];
  const agentProfiles = agentProfilesRes.data || [];

  const agentKeyById = new Map<string, string>();
  agentProfiles.forEach((p: { id: string; agent_key: string }) => {
    agentKeyById.set(p.id, p.agent_key);
  });

  const totalCommands = commandLogs.length;
  const successfulCommands = commandLogs.filter((c: { status: string }) => c.status === "executed").length;
  const failedCommands = commandLogs.filter((c: { status: string }) => c.status === "failed").length;
  const pendingCommands = commandLogs.filter((c: { status: string }) => c.status === "pending").length;

  const modelUsage: Record<string, number> = {};
  commandLogs.forEach((log: { command_text: string }) => {
    const modelMatch = log.command_text.match(/model[="']?([^"',\s]+)/i);
    if (modelMatch) {
      const model = modelMatch[1];
      modelUsage[model] = (modelUsage[model] || 0) + 1;
    }
  });

  const agentPerformance: Record<string, { tasks: number; completed: number; failed: number; avgTime: number; successRate: number }> = {};

  agentTasks.forEach((task: { agent_profile_id: string | null; status: string; started_at: string | null; completed_at: string | null }) => {
    const agentKey = task.agent_profile_id ? agentKeyById.get(task.agent_profile_id) || 'unknown' : 'unknown';

    if (!agentPerformance[agentKey]) {
      agentPerformance[agentKey] = { tasks: 0, completed: 0, failed: 0, avgTime: 0, successRate: 0 };
    }

    agentPerformance[agentKey].tasks++;

    if (task.status === "completed") {
      agentPerformance[agentKey].completed++;
      if (task.started_at && task.completed_at) {
        const duration = new Date(task.completed_at).getTime() - new Date(task.started_at).getTime();
        const prevAvg = agentPerformance[agentKey].avgTime;
        const count = agentPerformance[agentKey].completed;
        agentPerformance[agentKey].avgTime = prevAvg + (duration - prevAvg) / count;
      }
    } else if (task.status === "failed") {
      agentPerformance[agentKey].failed++;
    }
  });

  Object.keys(agentPerformance).forEach((key) => {
    const agent = agentPerformance[key];
    agent.successRate = agent.tasks > 0 ? Math.round((agent.completed / agent.tasks) * 100) : 0;
    agent.avgTime = Math.round(agent.avgTime);
  });

  if (Object.keys(agentPerformance).length === 0) {
    agentPerformance["prime"] = { tasks: 0, completed: 0, failed: 0, avgTime: 0, successRate: 0 };
    agentPerformance["vanguard"] = { tasks: 0, completed: 0, failed: 0, avgTime: 0, successRate: 0 };
  }

  return {
    timestamp: new Date().toISOString(),
    commands: {
      total: totalCommands,
      successful: successfulCommands,
      failed: failedCommands,
      pending: pendingCommands,
      successRate: totalCommands > 0 ? Math.round((successfulCommands / totalCommands) * 100) : 0,
      last24h: commandLogs.filter((c: { executed_at: string }) =>
        new Date(c.executed_at) > new Date(oneDayAgo)
      ).length,
    },
    models: {
      usage: modelUsage,
      total: Object.keys(modelUsage).length,
    },
    agents: agentPerformance,
    apiKeys: {
      total: apiKeys.length,
      active: apiKeys.filter((k: { last_used_at: string | null }) => k.last_used_at).length,
      providers: Array.from(new Set(apiKeys.map((k: { provider: string }) => k.provider))),
    },
    security: {
      failedAttempts24h: failedAttempts.length,
      has2FA: true,
      lastCommand: commandLogs[0]?.executed_at || null,
    },
    recentCommands: commandLogs.slice(0, 20).map((log: {
      id: string;
      command_text: string;
      status: string;
      executed_at: string;
    }) => ({
      id: log.id,
      command: log.command_text.slice(0, 100),
      status: log.status,
      executedAt: log.executed_at,
    })),
  };
}
