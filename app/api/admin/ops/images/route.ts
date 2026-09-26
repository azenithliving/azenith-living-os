/**
 * Qayyim Swarm - Images API
 * POST /api/admin/ops/images
 */

import { NextRequest, NextResponse } from "next/server";
import { syncLayer } from "@/lib/ops/memory/SyncLayer";
import { getCompanyId, getAgentInstance, ImageDraftSchema } from "@/lib/ops/api/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Reuse DraftSchema for image operations
    const parsed = ImageDraftSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const { agent, page_path, section_key, draft_type, instructions, context, company_id } = parsed.data;
    const companyId = await getCompanyId(company_id);

    const agentInstance = await getAgentInstance(agent);

    if (!agentInstance) {
      return NextResponse.json({ success: false, error: `Agent ${agent} does not support image operations` }, { status: 400 });
    }

    // Map draft_type to agent method
    let result;
    switch (draft_type) {
      case 'curate_gallery':
        result = await agentInstance.curateGallery({ page_path, section_key, context: { ...context, company_id: companyId } });
        break;
      case 'select_hero_image':
        result = await agentInstance.selectHeroImage({ page_path, section_key, context: { ...context, company_id: companyId } });
        break;
      case 'generate_alt_text':
        result = await agentInstance.generateAltText({ page_path, section_key, context: { ...context, company_id: companyId } });
        break;
      case 'brand_consistency_check':
        result = await agentInstance.brandConsistencyCheck({ page_path, section_key, context: { ...context, company_id: companyId } });
        break;
      default:
        return NextResponse.json({ success: false, error: `Unknown image operation: ${draft_type}` }, { status: 400 });
    }

    // Publish sync event
    await syncLayer.initialize(companyId);
    await syncLayer.publishDraftUpdate(agent, result.data?.draft_id || 'new', 'created', { page_path, section_key, draft_type });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[Qayyim Images API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Qayyim Images API - Use POST with { agent, page_path, section_key, draft_type (curate_gallery|select_hero_image|generate_alt_text|brand_consistency_check), context?, company_id? }',
  });
}