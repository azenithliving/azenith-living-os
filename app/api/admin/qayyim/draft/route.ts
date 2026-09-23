/**
 * Qayyim Swarm - Draft API
 * POST /api/admin/qayyim/draft
 */

import { NextRequest, NextResponse } from "next/server";
import { syncLayer } from "@/lib/qayyim/memory/SyncLayer";
import { getCompanyId, getAgentInstance, DraftSchema } from "@/lib/qayyim/api/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = DraftSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const { agent, page_path, section_key, draft_type, instructions, current_content, context, company_id } = parsed.data;
    const companyId = await getCompanyId(company_id);

    const agentInstance = await getAgentInstance(agent);

    if (!agentInstance) {
      return NextResponse.json({ success: false, error: `Agent ${agent} does not support drafting` }, { status: 400 });
    }

    // Map draft_type to agent method
    let result;
    switch (draft_type) {
      case 'hero_text':
      case 'section_reorder':
      case 'product_card':
      case 'tone_unification':
      case 'identity_fix':
      case 'storytelling':
        result = await agentInstance.draftCopy({
          page_path,
          section_key,
          draft_type: draft_type as any,
          instructions,
          current_content,
          context: { ...context, company_id: companyId },
        });
        break;
      case 'curate_gallery':
      case 'select_hero_image':
      case 'generate_alt_text':
      case 'brand_consistency_check':
        result = await agentInstance[{
          curate_gallery: 'curateGallery',
          select_hero_image: 'selectHeroImage',
          generate_alt_text: 'generateAltText',
          brand_consistency_check: 'brandConsistencyCheck',
        }[draft_type]]({ page_path, section_key, context: { ...context, company_id: companyId } });
        break;
      default:
        return NextResponse.json({ success: false, error: `Unknown draft type: ${draft_type}` }, { status: 400 });
    }

    // Publish sync event
    await syncLayer.initialize(companyId);
    await syncLayer.publishDraftUpdate(agent, result.data?.draft_id || 'new', 'created', { page_path, section_key, draft_type });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[Qayyim Draft API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Qayyim Draft API - Use POST with { agent, page_path, section_key, draft_type, instructions, current_content?, context?, company_id? }',
  });
}