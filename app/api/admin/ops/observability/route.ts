/**
 * The swarm's observability API.
 * GET /api/admin/ops/observability?metric=dashboard | agent_activity
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/dal/unified-supabase";
import { getCompanyId } from "@/lib/ops/api/utils";
import { AGENT_KEYS } from "@/lib/ops/identity";

export const dynamic = "force-dynamic";

/**
 * `agent_tasks` is the ledger every agent writes through `logTask`, so it is the
 * only complete record of what the swarm did. `ops_task_metrics` is written by two
 * agents alone (QA and Dev) and carries the quality-gate verdict, so it stays as a
 * second, narrower source rather than being mistaken for the whole truth.
 */
type TaskRow = {
  agent_key: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  actual_duration_minutes: number | null;
  created_at: string;
};

/** Milliseconds, from the only timing columns `agent_tasks` actually has. */
function durationMs(row: TaskRow): number | null {
  if (row.started_at && row.completed_at) {
    const ms = new Date(row.completed_at).getTime() - new Date(row.started_at).getTime();
    if (Number.isFinite(ms) && ms >= 0) return ms;
  }
  if (typeof row.actual_duration_minutes === 'number') return row.actual_duration_minutes * 60_000;
  return null;
}

function summarise(rows: TaskRow[], key: string) {
  const agentRows = rows.filter((r) => r.agent_key === key);
  const completed = agentRows.filter((r) => r.status === 'completed');
  const failed = agentRows.filter((r) => r.status === 'failed');
  const durations = agentRows.map(durationMs).filter((d): d is number => d !== null);
  const terminal = completed.length + failed.length;
  return {
    agent_key: key,
    total_24h: agentRows.length,
    completed_24h: completed.length,
    failed_24h: failed.length,
    avg_duration_ms: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    // Only answered tasks count: a pending task is not a failure.
    success_rate: terminal > 0 ? completed.length / terminal : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric') || 'dashboard';
    const companyId = await getCompanyId(searchParams.get('company_id') || undefined);

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    let query = supabaseServer
      .from('agent_tasks')
      .select('status, started_at, completed_at, actual_duration_minutes, created_at, agent_profiles(agent_key)')
      .gte('created_at', since);
    if (companyId) query = query.eq('company_id', companyId);
    const { data: taskRows, error: tasksError } = await query;

    let gateQuery = supabaseServer
      .from('ops_task_metrics')
      .select('quality_gate_result')
      .gte('created_at', since);
    if (companyId) gateQuery = gateQuery.eq('company_id', companyId);
    const { data: gateRows } = await gateQuery;

    if (tasksError) {
      if (metric === 'agent_activity') return NextResponse.json({ success: true, activity: [] });
      return NextResponse.json({
        success: true,
        dashboard: {
          agents: [],
          totals: { tasks_24h: 0, success_rate: null, avg_duration_ms: null },
          quality_gate: { passed_24h: 0, failed_24h: 0 },
        },
        warning: tasksError.message,
      });
    }

    const rows: TaskRow[] = (taskRows || []).map((r: any) => ({
      agent_key: r.agent_profiles?.agent_key ?? null,
      status: r.status,
      started_at: r.started_at,
      completed_at: r.completed_at,
      actual_duration_minutes: r.actual_duration_minutes,
      created_at: r.created_at,
    }));

    if (metric === 'agent_activity') {
      const activity = AGENT_KEYS.map((key) => {
        const agentRows = rows
          .filter((r) => r.agent_key === key)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return {
          agent_key: key,
          last_status: agentRows[0]?.status || null,
          last_at: agentRows[0]?.created_at || null,
          tasks_24h: agentRows.length,
        };
      });
      return NextResponse.json({ success: true, activity });
    }

    const perAgent = AGENT_KEYS.map((key) => summarise(rows, key)).filter((a) => a.total_24h > 0);

    const completedAll = rows.filter((r) => r.status === 'completed');
    const failedAll = rows.filter((r) => r.status === 'failed');
    const durationsAll = rows.map(durationMs).filter((d): d is number => d !== null);
    const gates = gateRows || [];

    const dashboard = {
      agents: perAgent,
      totals: {
        tasks_24h: rows.length,
        success_rate: completedAll.length + failedAll.length > 0
          ? completedAll.length / (completedAll.length + failedAll.length)
          : null,
        avg_duration_ms: durationsAll.length > 0
          ? Math.round(durationsAll.reduce((a, b) => a + b, 0) / durationsAll.length)
          : null,
      },
      quality_gate: {
        passed_24h: gates.filter((r: any) => r.quality_gate_result === 'passed').length,
        failed_24h: gates.filter((r: any) => r.quality_gate_result === 'failed').length,
      },
    };

    return NextResponse.json({ success: true, dashboard });
  } catch (error: any) {
    console.error('[ops observability] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
