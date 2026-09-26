/**
 * Qayyim Swarm - Benchmarks API
 * GET  /api/admin/qayyim/benchmarks → list benchmark definitions + recent runs
 * POST /api/admin/qayyim/benchmarks { benchmark_key, agent_key, sample_output? }
 */

import { NextRequest, NextResponse } from "next/server";
import { listBenchmarks, runBenchmark } from "@/lib/ops/benchmarks";
import { supabaseServer } from "@/lib/dal/unified-supabase";
import { getCompanyId } from "@/lib/ops/api/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data: recentRuns, error } = await supabaseServer
      .from('qayyim_benchmark_runs')
      .select('id, agent_key, benchmark_key, score, passed, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      // Table may not exist yet (migration not applied) — degrade gracefully
      return NextResponse.json({ success: true, benchmarks: listBenchmarks(), recent_runs: [], warning: error.message });
    }

    return NextResponse.json({ success: true, benchmarks: listBenchmarks(), recent_runs: recentRuns || [] });
  } catch (error: any) {
    console.error('[Qayyim Benchmarks API] GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { benchmark_key, agent_key, sample_output, company_id } = body;

    if (!benchmark_key || !agent_key) {
      return NextResponse.json({ success: false, error: 'benchmark_key and agent_key are required' }, { status: 400 });
    }

    // If no sample output provided, generate a fresh one by running the agent's self-check
    let output = sample_output;
    if (!output) {
      const agentModule = await import('@/lib/ops') as Record<string, any>;
      const agentsMap: Record<string, string> = {
        'ops-lead': 'qayyimCoreAgent',
        'ops-content': 'qayyimContentAgent',
        'ops-visual': 'qayyimVisualAgent',
        'ops-seo': 'qayyimSeoAgent',
        'ops-ux': 'qayyimUxAgent',
        'ops-analytics': 'qayyimAnalyticsAgent',
        'ops-dev': 'qayyimDevAgent',
        'ops-qa': 'qayyimQaAgent',
      };
      const agent = agentModule[agentsMap[agent_key]];
      if (!agent) {
        return NextResponse.json({ success: false, error: `Unknown agent: ${agent_key}` }, { status: 400 });
      }
      const probe = await agent.executeTask({
        id: `bench_${Date.now()}`,
        type: 'benchmark_probe',
        title: 'عينة معيار جودة',
        description: 'أنتج ملخصاً موجزاً لقدراتك مع مثال توصية قابلة للتنفيذ مدعومة بمقياس',
        context: { benchmark_probe: true },
        priority: 'low',
      });
      output = `${probe.summary || ''}\n${JSON.stringify(probe.data || {})}`;
    }

    const companyId = await getCompanyId(company_id);
    const result = await runBenchmark(benchmark_key, { agentKey: agent_key, output }, { company_id: companyId });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[Qayyim Benchmarks API] POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
