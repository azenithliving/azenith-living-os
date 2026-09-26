/**
 * Qayyim Swarm - A/B Testing API (QAYYIM-UX + QAYYIM-ANA)
 * POST /api/admin/ops/ab-test
 */

import { NextRequest, NextResponse } from "next/server";
import { getCompanyId, ABTestSchema } from "@/lib/ops/api/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ABTestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;
    const companyId = await getCompanyId(data.company_id);

    const agentModule = await import('@/lib/ops');

    let result;

    switch (data.action) {
      case 'design': {
        if (!data.hypothesis || !data.control_version || !data.variant_version) {
          return NextResponse.json(
            { success: false, error: 'hypothesis, control_version and variant_version are required for design' },
            { status: 400 }
          );
        }
        const uxAgent = agentModule.qayyimUxAgent;
        result = await uxAgent.designABTest({
          hypothesis: data.hypothesis,
          pagePath: data.page_path,
          sectionKey: data.section_key,
          controlVersion: data.control_version,
          variantVersion: data.variant_version,
          successMetric: data.success_metric || 'conversion_rate',
          minimumDetectableEffect: data.minimum_detectable_effect,
          durationDays: data.duration_days,
          context: { company_id: companyId },
        });
        break;
      }

      case 'predict_impact': {
        if (!data.proposed_change) {
          return NextResponse.json(
            { success: false, error: 'proposed_change is required for predict_impact' },
            { status: 400 }
          );
        }
        const anaAgent = agentModule.qayyimAnalyticsAgent;
        result = await anaAgent.predictImpact({
          proposedChange: data.proposed_change,
          pagePath: data.page_path,
          sectionKey: data.section_key,
          historicalPatterns: data.historical_patterns,
          context: { company_id: companyId },
        });
        break;
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${data.action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, action: data.action, result });
  } catch (error: any) {
    console.error('[Qayyim AB-Test API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Qayyim A/B Test API - POST with { action, page_path, section_key, hypothesis?, control_version?, variant_version?, proposed_change? }',
    actions: ['design', 'predict_impact'],
  });
}
