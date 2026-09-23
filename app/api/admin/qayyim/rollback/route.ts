/**
 * Qayyim Swarm - Rollback API
 * POST /api/admin/qayyim/rollback
 */

import { NextRequest, NextResponse } from "next/server";
import { syncLayer } from "@/lib/qayyim/memory/SyncLayer";
import { getCompanyId, RollbackSchema } from "@/lib/qayyim/api/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RollbackSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const { draft_id, target_version, company_id } = parsed.data;
    const companyId = await getCompanyId(company_id);

    const agentModule = await import('@/lib/qayyim');
    const coreAgent = agentModule.qayyimCoreAgent;

    const result = await coreAgent.rollbackDraft(draft_id, target_version);

    // Publish sync event
    if (result.success) {
      await syncLayer.initialize(companyId);
      await syncLayer.publishDraftUpdate('qayyim-core', draft_id, 'rolled_back', { target_version });
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[Qayyim Rollback API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Qayyim Rollback API - Use POST with { draft_id, target_version?, company_id? }',
  });
}