/**
 * Qayyim Swarm - Quality Assurance API (QAYYIM-QA)
 * POST /api/admin/qayyim/qa
 */

import { NextRequest, NextResponse } from "next/server";
import { getCompanyId, QaSchema } from "@/lib/ops/api/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // QA suites can be long-running

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = QaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;
    const companyId = await getCompanyId(data.company_id);

    const agentModule = await import('@/lib/ops');
    const qaAgent = agentModule.qayyimQaAgent;

    let result;

    switch (data.action) {
      case 'full_suite':
        result = await qaAgent.runFullQASuite({
          stagingUrl: data.staging_url,
          suites: data.suites,
          context: { company_id: companyId },
        });
        break;

      case 'e2e_smoke':
        result = await qaAgent.runE2ESmoke({
          testPaths: data.test_paths,
          baseUrl: data.base_url,
          headed: data.headed,
          context: { company_id: companyId },
        });
        break;

      case 'visual_regression':
        if (!data.pages || data.pages.length === 0) {
          return NextResponse.json({ success: false, error: 'pages array is required for visual_regression' }, { status: 400 });
        }
        result = await qaAgent.visualRegression({
          pages: data.pages,
          threshold: data.threshold,
          updateBaselines: data.update_baselines,
          context: { company_id: companyId },
        });
        break;

      case 'accessibility':
        if (!data.pages_simple || data.pages_simple.length === 0) {
          return NextResponse.json({ success: false, error: 'pages_simple array is required for accessibility' }, { status: 400 });
        }
        result = await qaAgent.accessibilityAudit({
          pages: data.pages_simple,
          standard: data.standard,
          includeBestPractices: data.include_best_practices,
          context: { company_id: companyId },
        });
        break;

      case 'load_test':
        if (!data.scenarios || !data.stages) {
          return NextResponse.json({ success: false, error: 'scenarios and stages are required for load_test' }, { status: 400 });
        }
        result = await qaAgent.loadTest({
          scenarios: data.scenarios,
          stages: data.stages,
          thresholds: data.thresholds,
          context: { company_id: companyId },
        });
        break;

      case 'security_scan':
        if (!data.target_url) {
          return NextResponse.json({ success: false, error: 'target_url is required for security_scan' }, { status: 400 });
        }
        result = await qaAgent.securityScan({
          targetUrl: data.target_url,
          checks: data.checks,
          context: { company_id: companyId },
        });
        break;

      case 'cross_browser':
        if (!data.pages_simple || data.pages_simple.length === 0) {
          return NextResponse.json({ success: false, error: 'pages_simple array is required for cross_browser' }, { status: 400 });
        }
        result = await qaAgent.crossBrowserTest({
          pages: data.pages_simple,
          browsers: data.browsers,
          devices: data.devices,
          context: { company_id: companyId },
        });
        break;

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${data.action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, action: data.action, result });
  } catch (error: any) {
    console.error('[Qayyim QA API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Qayyim QA API (QAYYIM-QA) - POST with { action, ...params }',
    actions: ['full_suite', 'e2e_smoke', 'visual_regression', 'accessibility', 'load_test', 'security_scan', 'cross_browser'],
  });
}
