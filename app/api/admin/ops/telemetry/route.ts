/**
 * Qayyim Swarm - Telemetry & Behavior API (QAYYIM-UX)
 * POST /api/admin/ops/telemetry
 */

import { NextRequest, NextResponse } from "next/server";
import { getCompanyId, TelemetrySchema } from "@/lib/ops/api/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = TelemetrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;
    const companyId = await getCompanyId(data.company_id);

    const agentModule = await import('@/lib/ops');
    const uxAgent = agentModule.qayyimUxAgent;

    let result;

    switch (data.action) {
      case 'analyze_behavior':
        result = await uxAgent.analyzeBehavior({
          pagePath: data.page_path,
          sectionKey: data.section_key,
          timeRange: data.time_range || '7d',
          metrics: data.metrics,
          context: { company_id: companyId },
        });
        break;

      case 'exit_rate_report':
        result = await uxAgent.exitRateReport({
          pagePath: data.page_path,
          timeRange: data.time_range === '1h' ? '24h' : (data.time_range || '7d'),
          threshold: data.threshold,
          context: { company_id: companyId },
        });
        break;

      case 'create_goal':
        if (!data.goal) {
          return NextResponse.json({ success: false, error: 'goal object is required for create_goal' }, { status: 400 });
        }
        result = await uxAgent.createGoal({
          name: data.goal.name,
          targetMetric: data.goal.target_metric,
          targetValue: data.goal.target_value,
          pagePath: data.page_path,
          sectionKey: data.section_key,
          deadlineDays: data.goal.deadline_days,
          context: { company_id: companyId },
        });
        break;

      case 'get_goals':
        result = await uxAgent.executeTask({
          id: `goals_${Date.now()}`,
          type: 'goal_check_progress',
          title: 'قائمة الأهداف النشطة',
          description: 'عرض جميع أهداف التحويل النشطة وحالة تقدمها',
          context: { company_id: companyId, action: 'list_goals', page_path: data.page_path },
          priority: 'medium',
        });
        break;

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${data.action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, action: data.action, result });
  } catch (error: any) {
    console.error('[Qayyim Telemetry API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Qayyim Telemetry API (QAYYIM-UX) - POST with { action, page_path?, section_key?, time_range?, metrics?, goal? }',
    actions: ['analyze_behavior', 'exit_rate_report', 'create_goal', 'get_goals'],
  });
}
