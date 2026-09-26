/**
 * Qayyim Swarm - Identity Check API
 * POST /api/admin/ops/identity
 */

import { NextRequest, NextResponse } from "next/server";
import { syncLayer } from "@/lib/ops/memory/SyncLayer";
import { getCompanyId, getAgentInstance, IdentityDraftSchema } from "@/lib/ops/api/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = IdentityDraftSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const { agent, page_path, section_key, draft_type, instructions, current_content, context, company_id } = parsed.data;
    const companyId = await getCompanyId(company_id);

    const agentInstance = await getAgentInstance(agent);

    if (!agentInstance) {
      return NextResponse.json({ success: false, error: `Agent ${agent} does not support identity operations` }, { status: 400 });
    }

    // Identity operations only for content agent
    if (agent !== 'ops-content') {
      return NextResponse.json({ success: false, error: 'Identity operations only available for ops-content agent' }, { status: 400 });
    }

    let result;
    switch (draft_type) {
      case 'identity_fix':
        result = await agentInstance.draftCopy({
          page_path,
          section_key,
          draft_type: 'identity_fix',
          instructions,
          current_content,
          context: { ...context, company_id: companyId },
        });
        break;
      default:
        return NextResponse.json({ success: false, error: `Unknown identity operation: ${draft_type}` }, { status: 400 });
    }

    // Publish sync event
    await syncLayer.initialize(companyId);
    await syncLayer.publishDraftUpdate(agent, result.data?.draft_id || 'new', 'created', { page_path, section_key, draft_type });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[Qayyim Identity API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Qayyim Identity API - Use POST with { agent: "ops-content", page_path, section_key, draft_type: "identity_fix", instructions, current_content?, context?, company_id? }',
  });
}