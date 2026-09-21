import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { resolvePrimaryCompanyId } from "@/lib/company-resolver";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

const SUCCESS_STATUSES = new Set(["executed", "completed", "success", "done"]);
const FAILED_STATUSES = new Set(["failed", "error"]);

/**
 * Read-only statistics used by the admin overview.  The route deliberately
 * reports only records that exist in the database; it never invents agents,
 * 2FA state, or activity when the underlying tables are empty.
 */
export async function GET() {
  const { user, unauthorized } = await requireAdminApi();
  if (unauthorized || !user) return unauthorized!;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase admin client unavailable" },
      { status: 503 },
    );
  }

  try {
    const companyId = await resolvePrimaryCompanyId();
    const stats = await gatherMastermindStats(supabase, user.id, companyId);

    return NextResponse.json({
      success: true,
      ...stats,
      meta: { actorId: user.id, companyId },
    });
  } catch (error) {
    console.error("[AdminStats] Failed to collect dashboard statistics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard statistics" },
      { status: 500 },
    );
  }
}

async function gatherMastermindStats(supabase: AdminClient, userId: string, companyId: string) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [commandLogsRes, apiKeysRes, failedAttemptsRes, agentTasksRes, agentProfilesRes, user2FARes] = await Promise.all([
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
      .select("id, agent_key"),
    supabase
      .from("user_2fa")
      .select("is_enabled")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const rawErrors: Array<[string, { message: string } | null | undefined]> = [
    ["immutable_command_log", commandLogsRes.error],
    ["api_keys", apiKeysRes.error],
    ["failed_login_attempts", failedAttemptsRes.error],
    ["agent_tasks", agentTasksRes.error],
    ["agent_profiles", agentProfilesRes.error],
    ["user_2fa", user2FARes.error],
  ];

  const warnings = rawErrors
    .filter((entry): entry is [string, { message: string }] => Boolean(entry[1]))
    .map(([table, error]) => `${table}: ${error.message}`);

  const commandLogs = commandLogsRes.data ?? [];
  const apiKeys = apiKeysRes.data ?? [];
  const failedAttempts = failedAttemptsRes.data ?? [];
  const agentTasks = agentTasksRes.data ?? [];
  const agentProfiles = agentProfilesRes.data ?? [];

  const agentKeyById = new Map<string, string>();
  for (const profile of agentProfiles) {
    if (profile.id && profile.agent_key) agentKeyById.set(profile.id, profile.agent_key);
  }

  const agentPerformance: Record<string, { tasks: number; completed: number; failed: number; avgTime: number; successRate: number }> = {};
  for (const task of agentTasks) {
    const agentKey = task.agent_profile_id ? agentKeyById.get(task.agent_profile_id) ?? "unassigned" : "unassigned";
    const agent = agentPerformance[agentKey] ?? {
      tasks: 0,
      completed: 0,
      failed: 0,
      avgTime: 0,
      successRate: 0,
    };

    agent.tasks += 1;
    const normalizedStatus = String(task.status ?? "").toLowerCase();
    if (SUCCESS_STATUSES.has(normalizedStatus)) {
      agent.completed += 1;
      if (task.started_at && task.completed_at) {
        const duration = new Date(task.completed_at).getTime() - new Date(task.started_at).getTime();
        if (Number.isFinite(duration) && duration >= 0) {
          agent.avgTime += (duration - agent.avgTime) / agent.completed;
        }
      }
    } else if (FAILED_STATUSES.has(normalizedStatus)) {
      agent.failed += 1;
    }

    agentPerformance[agentKey] = agent;
  }

  for (const agent of Object.values(agentPerformance)) {
    agent.avgTime = Math.round(agent.avgTime);
    agent.successRate = agent.tasks ? Math.round((agent.completed / agent.tasks) * 100) : 0;
  }

  const commandStatus = (command: { status: string | null }) => String(command.status ?? "").toLowerCase();
  const successfulCommands = commandLogs.filter((command) => SUCCESS_STATUSES.has(commandStatus(command))).length;
  const failedCommands = commandLogs.filter((command) => FAILED_STATUSES.has(commandStatus(command))).length;
  const pendingCommands = commandLogs.filter((command) => {
    const status = commandStatus(command);
    return status && !SUCCESS_STATUSES.has(status) && !FAILED_STATUSES.has(status);
  }).length;

  const modelUsage: Record<string, number> = {};
  for (const log of commandLogs) {
    const match = log.command_text?.match(/model[="']?([^",'\s]+)/i);
    if (match?.[1]) modelUsage[match[1]] = (modelUsage[match[1]] ?? 0) + 1;
  }

  return {
    timestamp: new Date().toISOString(),
    warnings,
    commands: {
      total: commandLogs.length,
      successful: successfulCommands,
      failed: failedCommands,
      pending: pendingCommands,
      successRate: commandLogs.length ? Math.round((successfulCommands / commandLogs.length) * 100) : 0,
      last24h: commandLogs.filter((command) => command.executed_at && new Date(command.executed_at) > new Date(oneDayAgo)).length,
    },
    models: {
      usage: modelUsage,
      total: Object.keys(modelUsage).length,
    },
    agents: agentPerformance,
    apiKeys: {
      enabled: apiKeys.length,
      recentlyUsed: apiKeys.filter((key) => Boolean(key.last_used_at)).length,
      providers: [...new Set(apiKeys.map((key) => key.provider).filter(Boolean))],
    },
    security: {
      failedAttempts24h: failedAttempts.length,
      has2FA: user2FARes.data?.is_enabled === true,
      lastCommand: commandLogs[0]?.executed_at ?? null,
    },
    recentCommands: commandLogs.slice(0, 20).map((log) => ({
      id: log.id,
      command: (log.command_text ?? "").slice(0, 100),
      status: log.status,
      executedAt: log.executed_at,
    })),
  };
}
