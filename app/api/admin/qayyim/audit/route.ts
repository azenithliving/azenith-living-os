/**
 * Qayyim Swarm - Audit API
 * POST /api/admin/qayyim/audit
 */

import { NextRequest, NextResponse } from "next/server";
import { masterOrchestrator } from "@/lib/qayyim";
import { getCompanyId, AuditSchema } from "@/lib/qayyim/api/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AuditSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const { page_path = '/', scope = 'full', company_id } = parsed.data;
    const companyId = await getCompanyId(company_id);

    const agentModule = await import('@/lib/qayyim');
    const coreAgent = agentModule.qayyimCoreAgent;

    const result = await coreAgent.auditFullSite({
      page_path,
      scope,
      company_id: companyId,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[Qayyim Audit API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Qayyim Audit API - Use POST with { page_path?, scope?, company_id? }',
  });
}