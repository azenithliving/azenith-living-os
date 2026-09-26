/**
 * Qayyim Swarm - Performance & Engineering API (QAYYIM-DEV + QAYYIM-ANA)
 * POST /api/admin/ops/perf
 */

import { NextRequest, NextResponse } from "next/server";
import { getCompanyId, PerfSchema } from "@/lib/ops/api/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = PerfSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;
    const companyId = await getCompanyId(data.company_id);

    const agentModule = await import('@/lib/ops');
    const devAgent = agentModule.qayyimDevAgent;
    const anaAgent = agentModule.qayyimAnalyticsAgent;

    let result;

    switch (data.action) {
      case 'performance_budgets':
        result = await devAgent.performanceBudgets({
          budgets: data.budgets,
          pagePath: data.page_path,
          context: { company_id: companyId },
        });
        break;

      case 'bundle_analysis':
        result = await devAgent.bundleAnalysis({
          includeChunks: data.include_chunks,
          thresholdKB: data.threshold_kb,
          context: { company_id: companyId },
        });
        break;

      case 'dependency_audit':
        result = await devAgent.dependencyAudit({
          checkVulnerabilities: data.check_vulnerabilities,
          checkOutdated: data.check_outdated,
          checkUnused: data.check_unused,
          checkLicenses: data.check_licenses,
          context: { company_id: companyId },
        });
        break;

      case 'code_review':
        result = await devAgent.codeReview({
          scope: data.scope || 'changed_files',
          paths: data.paths,
          context: { company_id: companyId },
        });
        break;

      case 'security_code_scan':
        result = await devAgent.securityCodeScan({
          checkXSS: data.check_xss,
          checkInjection: data.check_injection,
          checkSecrets: data.check_secrets,
          checkCSP: data.check_csp,
          context: { company_id: companyId },
        });
        break;

      case 'luxury_score':
        result = await anaAgent.calculateLuxuryScore({
          scope: data.luxury_scope || 'full_site',
          targetPath: data.page_path,
          weights: data.weights,
          context: { company_id: companyId },
        });
        break;

      case 'revenue_correlation':
        result = await anaAgent.revenueCorrelation({
          timeRange: data.time_range || '30d',
          segmentBy: data.segment_by,
          context: { company_id: companyId },
        });
        break;

      case 'weekly_report':
        result = await anaAgent.weeklyLuxuryReport({
          weekStart: data.week_start,
          context: { company_id: companyId },
        });
        break;

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${data.action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, action: data.action, result });
  } catch (error: any) {
    console.error('[Qayyim Perf API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Qayyim Performance API (QAYYIM-DEV + QAYYIM-ANA) - POST with { action, ...params }',
    actions: ['performance_budgets', 'bundle_analysis', 'dependency_audit', 'code_review', 'security_code_scan', 'luxury_score', 'revenue_correlation', 'weekly_report'],
  });
}
