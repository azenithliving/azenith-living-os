/**
 * Qayyim Swarm - Observability API
 * GET /api/admin/qayyim/observability?metric=dashboard | agent_activity
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/dal/unified-supabase";
import { getCompanyId } from "@/lib/ops/api/utils";

export const dynamic = "force-dynamic";

const AGENT_KEYS = [
  'ops-lead', 'ops-content', 'ops-visual', 'ops-seo',
  'ops-ux', 'ops-analytics', 'ops-dev', 'ops-qa',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric') || 'dashboard';
    const companyId = await getCompanyId(searchParams.get('company_id') || undefined);

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    let query = supabaseServer
      .from('qayyim_task_metrics')
      .select('agent_key, task_id, status, duration_ms, quality_gate_result, created_at')
      .gte('created_at', since);

    if (companyId) query = query.eq('company_id', companyId);

    const { data: rows, error } = await query;

    if (error) {
      // Table may not exist yet — return empty-but-valid shape
      if (metric === 'agent_activity') return NextResponse.json({ success: true, activity: [] });
      return NextResponse.json({
        success: true,
        dashboard: {
          agents: [],
          totals: { tasks_24h: 0, success_rate: null, avg_duration_ms: null },
          quality_gate: { passed_24h: 0, failed_24h: 0 },
        },
        warning: error.message,
      });
    }

    const metrics = rows || [];

    if (metric === 'agent_activity') {
      // Latest status + count per agent
      const activity = AGENT_KEYS.map((key) => {
        const agentRows = metrics
          .filter((r) => r.agent_key === key)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return {
          agent_key: key,
          last_status: (agentRows[0]?.status as any) || null,
          last_at: agentRows[0]?.created_at || null,
          tasks_24h: agentRows.length,
        };
      });
      return NextResponse.json({ success: true, activity });
    }

    // dashboard
    const agents = AGENT_KEYS.map((key) => {
      const agentRows = metrics.filter((r) => r.agent_key === key);
      const completed = agentRows.filter((r) => r.status === 'completed');
      const failed = agentRows.filter((r) => r.status === 'failed');
      const durations = completed.map((r) => r.duration_ms).filter((d): d is number => typeof d === 'number');
      return {
        agent_key: key,
        total_24h: agentRows.length,
        completed_24h: completed.length,
        failed_24h: failed.length,
        avg_duration_ms: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
        success_rate: agentRows.length > 0 ? completed.length / agentRows.length : null,
      };
    }).filter((a) => a.total_24h > 0);

    const allCompleted = metrics.filter((r) => r.status === 'completed');
    const allFailed = metrics.filter((r) => r.status === 'failed');
    const allDurations = allCompleted.map((r) => r.duration_ms).filter((d): d is number => typeof d === 'number');

    const dashboard = {
      agents,
      totals: {
        tasks_24h: metrics.length,
        success_rate: metrics.length > 0 ? allCompleted.length / metrics.length : null,
        avg_duration_ms: allDurations.length > 0 ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length) : null,
      },
      quality_gate: {
        passed_24h: metrics.filter((r) => r.quality_gate_result === 'passed').length,
        failed_24h: metrics.filter((r) => r.quality_gate_result === 'failed').length,
      },
    };

    return NextResponse.json({ success: true, dashboard });
  } catch (error: any) {
    console.error('[Qayyim Observability API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
