/**
 * Qayyim Swarm - Publish API
 * POST /api/admin/ops/publish
 */

import { NextRequest, NextResponse } from "next/server";
import { syncLayer } from "@/lib/ops/memory/SyncLayer";
import { getCompanyId, PublishSchema } from "@/lib/ops/api/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = PublishSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const { draft_id, approved_by, company_id } = parsed.data;
    const companyId = await getCompanyId(company_id);

    const agentModule = await import('@/lib/ops');
    const coreAgent = agentModule.qayyimCoreAgent;

    const result = await coreAgent.publishDraft(draft_id, approved_by);

    // Publish sync event
    if (result.success) {
      await syncLayer.initialize(companyId);
      await syncLayer.publishDraftUpdate('ops-lead', draft_id, 'published', { approved_by });
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[Qayyim Publish API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Qayyim Publish API - Use POST with { draft_id, approved_by, company_id? }',
  });
}